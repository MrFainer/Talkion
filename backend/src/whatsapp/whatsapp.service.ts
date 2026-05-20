import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { PrismaService } from '../prisma.service';
import { AiService } from '../ai/ai.service';
import { QuizService } from '../quiz/quiz.service';
import { NewsService } from '../news/news.service';
import { randomUUID } from 'crypto';

type QuizQuestion = {
  question: string;
  options: string[];
  correct_answer: string;
};

type ParsedQuizAnswer = {
  questionIndex?: number;
  selectedAnswer: 'A' | 'B' | 'C';
};

type QrCodeCacheEntry = {
  base64: string;
  timestamp: number;
};

type StudentContext = {
  id: string;
  teacher_id?: string | null;
  full_name: string;
  whatsapp_number: string;
  english_level?: string;
  active?: boolean;
};

type OutboundMessageTracking = {
  studentId?: string | null;
  remoteJid?: string | null;
  relatedNewsId?: string | null;
  relatedQuizId?: string | null;
  contentKind?: string | null;
  quotedMessageId?: string | null;
};

type EvolutionGroup = {
  id: string;
  subject: string;
  owner?: string | null;
  size?: number | null;
  creation?: number | null;
  desc?: string | null;
};

type WhatsappSyncStage =
  | 'idle'
  | 'waiting_connection'
  | 'warming_up'
  | 'syncing_groups'
  | 'ready'
  | 'degraded'
  | 'error';

type WhatsappSyncState = {
  teacherId: string;
  stage: WhatsappSyncStage;
  progress: number;
  message: string;
  inProgress: boolean;
  ready: boolean;
  stale: boolean;
  attempts: number;
  groupsCount: number;
  lastError: string | null;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
};

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly evolutionApiUrl =
    process.env.EVOLUTION_URL ||
    process.env.EVOLUTION_API_URL ||
    'http://localhost:8080';
  private readonly apiKey =
    process.env.EVOLUTION_API_KEY || 'global_api_key_talkion';
  private readonly defaultNewsGroupTitle =
    process.env.WHATSAPP_NEWS_GROUP_TITLE || 'Desafio News in English';
  private readonly backendUrl = process.env.BACKEND_URL || '';
  private readonly allowSelfWhatsappTest =
    process.env.ALLOW_SELF_WHATSAPP_TEST === 'true';
  private readonly http: AxiosInstance = axios.create({
    baseURL: this.evolutionApiUrl,
    timeout: 15000,
    headers: {
      apikey: this.apiKey,
      'Content-Type': 'application/json',
    },
  });
  private readonly qrCodeCache = new Map<string, QrCodeCacheEntry>();
  private readonly qrCodeTtlMs = 30_000;
  private readonly syncStateByTeacher = new Map<string, WhatsappSyncState>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly quizService: QuizService,
    private readonly newsService: NewsService,
  ) {}

  async resolveInstanceName(teacherId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: teacherId }
    });
    
    if (!user) {
      throw new BadRequestException('Professor não encontrado.');
    }

    if (user.whatsapp_instance_name) {
      return user.whatsapp_instance_name;
    }

    const newInstanceName = `talkion_prof_${teacherId.substring(0, 8)}`;
    await this.prisma.user.update({
      where: { id: teacherId },
      data: { whatsapp_instance_name: newInstanceName }
    });

    return newInstanceName;
  }

  /**
   * Garante que a instância principal exista na Evolution API.
   */
  async getOrCreateInstance(teacherId: string) {
    const instanceName = await this.resolveInstanceName(teacherId);
    const existingInstance = await this.fetchInstance(instanceName);

    if (existingInstance) {
      return this.normalizeInstance(existingInstance, instanceName);
    }

    await this.createInstance(instanceName);

    if (this.getWebhookUrl()) {
      await this.setWebhook(instanceName);
    }

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const createdInstance = await this.fetchInstance(instanceName);
      if (createdInstance) {
        return this.normalizeInstance(createdInstance, instanceName);
      }

      await this.sleep(1000);
    }

    return this.normalizeInstance(null, instanceName);
  }

  /**
   * Retorna o estado atual da instância e tenta garantir que ela exista.
   */
  async getStatus(teacherId: string) {
    const instance = await this.getOrCreateInstance(teacherId);
    return {
      ...instance,
      webhookUrl: this.getWebhookUrl(),
    };
  }

  /**
   * Tenta obter o QR Code de conexão da instância.
   */
  async getQrCode(teacherId: string) {
    const instanceName = await this.resolveInstanceName(teacherId);
    const cached = this.getCachedQrCode(instanceName);
    if (cached) {
      return {
        status: 'QRCODE_AVAILABLE',
        qrcode: {
          base64: cached,
          cached: true,
        },
      };
    }

    const instance = await this.getOrCreateInstance(teacherId);

    if (instance.status === 'open') {
      return {
        status: 'CONNECTED',
        qrcode: {
          base64: null,
          cached: false,
        },
      };
    }

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await this.http.get(
          `/instance/connect/${instanceName}`,
        );
        const qrCode =
          this.extractQrCode(response.data) || this.getCachedQrCode(instanceName);

        if (qrCode) {
          this.setCachedQrCode(instanceName, qrCode);
          return {
            status: 'QRCODE_AVAILABLE',
            qrcode: {
              base64: qrCode,
              cached: false,
              attempt,
            },
          };
        }
      } catch (error) {
        this.logger.error(
          `[QRCODE][ERRO] Falha ao obter QR Code na tentativa ${attempt}`,
          this.describeError(error),
        );
      }

      await this.sleep(3000);
    }

    return {
      status: 'PENDING',
      qrcode: {
        base64: null,
        cached: false,
      },
    };
  }

  /**
   * Configura o webhook da instância principal.
   */
  async registerWebhook(teacherId: string) {
    const instanceName = await this.resolveInstanceName(teacherId);
    return this.setWebhook(instanceName);
  }

  async getSyncStatus(teacherId: string) {
    const instance = await this.getOrCreateInstance(teacherId);

    if (instance.status !== 'open') {
      const state = this.updateSyncState(teacherId, {
        stage: 'waiting_connection',
        progress: 0,
        message: 'Conecte o WhatsApp para iniciar a sincronizacao.',
        inProgress: false,
        ready: false,
        stale: false,
        attempts: 0,
        groupsCount: 0,
        lastError: null,
        startedAt: null,
        completedAt: null,
      });

      return {
        connected: false,
        sync: state,
      };
    }

    const currentState = this.getSyncState(teacherId);

    if (!currentState.ready && !currentState.inProgress) {
      const groupCount = await this.prisma.whatsappGroup.count({
        where: { teacher_id: teacherId },
      });
      if (groupCount === 0) {
        this.startTeacherSync(teacherId);
        return {
          connected: true,
          sync: this.getSyncState(teacherId),
        };
      } else {
        // Já tem grupos no banco mas o estado de sync na memória estava vazio (ex: servidor reiniciou)
        const lastGroup = await this.prisma.whatsappGroup.findFirst({
          where: { teacher_id: teacherId },
          orderBy: { created_at: 'desc' }
        });
        
        const state = this.updateSyncState(teacherId, {
          stage: 'ready',
          progress: 100,
          message: `Sincronizacao concluida. ${groupCount} grupo(s) disponivel(is).`,
          inProgress: false,
          ready: true,
          groupsCount: groupCount,
          completedAt: lastGroup ? lastGroup.created_at.toISOString() : new Date().toISOString(),
        });

        return {
          connected: true,
          sync: state,
        };
      }
    }

    return {
      connected: true,
      sync: currentState,
    };
  }

  async triggerSync(teacherId: string) {
    const instance = await this.getOrCreateInstance(teacherId);

    if (instance.status !== 'open') {
      throw new BadRequestException(
        'O WhatsApp do professor precisa estar conectado para sincronizar.',
      );
    }

    this.startTeacherSync(teacherId, true);

    return {
      connected: true,
      sync: this.getSyncState(teacherId),
    };
  }

  /**
   * Remove a instância da Evolution API.
   */
  async logout(teacherId: string) {
    const instanceName = await this.resolveInstanceName(teacherId);
    await this.http.delete(`/instance/delete/${instanceName}`);
    this.qrCodeCache.delete(instanceName);
    this.resetAllSyncStates('idle', 'WhatsApp desconectado.'); // Optional: maybe only reset for this teacher?
    
    // Better to reset only for this teacher
    this.updateSyncState(teacherId, {
      stage: 'idle',
      progress: 0,
      message: 'WhatsApp desconectado.',
      inProgress: false,
      ready: false,
      stale: false,
      attempts: 0,
      groupsCount: 0,
      lastError: null,
      startedAt: null,
      completedAt: null,
    });

    return { success: true };
  }

  /**
   * Envia uma mensagem de texto (Notícia, Quiz, etc) para um grupo ou pessoa.
   */
  async sendMessage(
    teacherId: string,
    numberOrGroupId: string,
    text: string,
    tracking?: OutboundMessageTracking,
  ) {
    try {
      const instanceName = await this.resolveInstanceName(teacherId);
      const response = await this.http.post(`/message/sendText/${instanceName}`, {
        number: numberOrGroupId,
        text,
      });

      await this.saveOutgoingMessageToDb({
        studentId: tracking?.studentId || null,
        remoteJid:
          tracking?.remoteJid ||
          response.data?.key?.remoteJid ||
          this.normalizeRemoteJid(numberOrGroupId),
        relatedNewsId: tracking?.relatedNewsId || null,
        relatedQuizId: tracking?.relatedQuizId || null,
        contentKind: tracking?.contentKind || 'TEXT',
        quotedMessageId: tracking?.quotedMessageId || null,
        externalMessageId: response.data?.key?.id || null,
        content: text,
      });

      this.logger.log(`[SAIDA] Mensagem WhatsApp enviada para ${numberOrGroupId}`);
      return response.data;
    } catch (error) {
      this.logger.error(
        `[SAIDA][ERRO] Falha ao enviar mensagem para ${numberOrGroupId}`,
        this.describeError(error),
      );
      throw error;
    }
  }

  /**
   * Verifica se o número possui WhatsApp ativo
   */
  async checkNumber(teacherId: string, number: string) {
    try {
      const instanceName = await this.resolveInstanceName(teacherId);
      // Usando o endpoint /chat/whatsappNumbers/{instance} que é comum em Evolution API V2
      const response = await this.http.post(`/chat/whatsappNumbers/${instanceName}`, {
        numbers: [number]
      }, { timeout: 15000 }); // Aguarda até 15 segundos pela validação real

      // A API retorna um array de resultados
      if (Array.isArray(response.data) && response.data.length > 0) {
        return response.data[0].exists === true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Erro ao verificar o número ${number}`, this.describeError(error));
      // Só insere no banco como true se realmente for validado pela API. Se der erro/timeout, fica false.
      return false;
    }
  }

  async listGroups(teacherId: string) {
    const instance = await this.getOrCreateInstance(teacherId);

    if (instance.status !== 'open') {
      throw new BadRequestException(
        'O WhatsApp do professor precisa estar conectado para listar os grupos.',
      );
    }

    try {
      const groups = await this.fetchGroupsFromEvolution(teacherId, 60000);
      await this.cacheGroups(teacherId, groups);
      this.markSyncAsReady(teacherId, groups.length, false, null);

      return {
        connected: true,
        count: groups.length,
        groups,
      };
    } catch (error) {
      const details = this.describeError(error);
      this.logger.error(
        `[GROUPS][ERRO] Falha ao listar grupos para o professor ${teacherId}`,
        details,
      );

      if (this.isRequestTimeout(error)) {
        const cachedGroups = await this.getCachedGroups(teacherId);
        if (cachedGroups.length > 0) {
          this.logger.warn(
            `[GROUPS][FALLBACK] Usando ${cachedGroups.length} grupo(s) em cache do banco para o professor ${teacherId}.`,
          );
          this.markSyncAsReady(
            teacherId,
            cachedGroups.length,
            true,
            'A Evolution demorou para responder. Exibindo grupos sincronizados anteriormente.',
          );
          return {
            connected: true,
            count: cachedGroups.length,
            groups: cachedGroups,
            stale: true,
          };
        }
      }

      this.updateSyncState(teacherId, {
        stage: 'error',
        progress: 100,
        message:
          'Falha ao sincronizar os grupos. A Evolution demorou para responder.',
        inProgress: false,
        ready: false,
        stale: false,
        lastError: this.describeError(error),
        completedAt: new Date().toISOString(),
      });

      throw new BadRequestException(
        'Nao foi possivel listar os grupos do WhatsApp agora. A instancia esta conectada, mas a Evolution demorou para responder. Tente novamente em instantes.',
      );
    }
  }

  async listStoredGroups(teacherId: string) {
    const instance = await this.getOrCreateInstance(teacherId);
    const syncStatus = await this.getSyncStatus(teacherId);

    const groups = await this.getCachedGroups(teacherId);

    return {
      connected: instance.status === 'open',
      count: groups.length,
      groups,
      sync: syncStatus.sync,
    };
  }

  async validateGroupTitle(teacherId: string, title: string) {
    const search = title?.trim();
    if (!search) {
      throw new BadRequestException('O título do grupo é obrigatório.');
    }

    const result = await this.listStoredGroups(teacherId);
    const normalizedSearch = this.normalizeGroupTitle(search);

    const scoredMatches = result.groups
      .map((group) => {
        const normalizedSubject = this.normalizeGroupTitle(group.subject);
        let score = 0;

        if (normalizedSubject === normalizedSearch) {
          score = 100;
        } else if (normalizedSubject.includes(normalizedSearch)) {
          score = 80;
        } else if (normalizedSearch.includes(normalizedSubject)) {
          score = 70;
        } else {
          const searchTokens = normalizedSearch.split(' ').filter(Boolean);
          const subjectTokens = normalizedSubject.split(' ').filter(Boolean);
          const matchedTokens = searchTokens.filter((token) =>
            subjectTokens.some((subjectToken) => subjectToken.includes(token)),
          ).length;

          if (matchedTokens > 0) {
            score = Math.round((matchedTokens / searchTokens.length) * 60);
          }
        }

        return {
          ...group,
          score,
        };
      })
      .filter((group) => group.score > 0)
      .sort((a, b) => b.score - a.score || a.subject.localeCompare(b.subject));

    return {
      search,
      found: scoredMatches.length > 0,
      recommendedGroup: scoredMatches[0] || null,
      matches: scoredMatches,
    };
  }

  async getConfiguredNewsGroup(teacherId: string, title?: string) {
    const configuredTitle =
      title?.trim() || (await this.getTeacherNewsGroupTitle(teacherId));
    const validation = await this.validateGroupTitle(
      teacherId,
      configuredTitle,
    );
    const exactMatch = validation.matches.find(
      (group) =>
        this.normalizeGroupTitle(group.subject) ===
        this.normalizeGroupTitle(configuredTitle),
    );

    return {
      configuredTitle,
      found: validation.found,
      exactMatch: exactMatch || null,
      recommendedGroup: validation.recommendedGroup,
      matches: validation.matches,
    };
  }

  async getNewsGroupSettings(teacherId: string, title?: string) {
    const configuredTitle =
      title?.trim() || (await this.getTeacherNewsGroupTitle(teacherId));
    const target = await this.getConfiguredNewsGroup(teacherId, configuredTitle);

    return {
      teacherId,
      configuredTitle,
      found: target.found,
      exactMatch: target.exactMatch,
      recommendedGroup: target.recommendedGroup,
      matches: target.matches,
    };
  }

  async updateNewsGroupSettings(teacherId: string, title: string) {
    const normalizedTitle = title?.trim();
    if (!normalizedTitle) {
      throw new BadRequestException('O nome do grupo é obrigatório.');
    }

    await this.prisma.user.update({
      where: { id: teacherId },
      data: { news_group_title: normalizedTitle },
    });

    return this.getNewsGroupSettings(teacherId);
  }

  async sendLatestNewsToConfiguredGroup(
    teacherId: string,
    options?: { title?: string; groupId?: string; groupLevel?: string },
  ) {
    const selectedGroup = options?.groupId
      ? await this.resolveGroupById(teacherId, options.groupId)
      : null;
    const target = selectedGroup
      ? {
          configuredTitle: selectedGroup.subject,
          found: true,
          exactMatch: selectedGroup,
          recommendedGroup: selectedGroup,
          matches: [selectedGroup],
        }
      : await this.getConfiguredNewsGroup(teacherId, options?.title);
    const resolvedGroup =
      selectedGroup || target.exactMatch || target.recommendedGroup;

    if (!resolvedGroup) {
      throw new BadRequestException(
        `Nenhum grupo compatível com "${target.configuredTitle}" foi encontrado no banco de dados. Por favor, desconecte e conecte o WhatsApp novamente para ressincronizar os grupos.`,
      );
    }

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const alreadySent = await this.prisma.whatsappMessage.findFirst({
      where: {
        direction: 'OUTGOING',
        remote_jid: this.normalizeRemoteJid(resolvedGroup.id),
        content_kind: 'NEWS',
        created_at: { gte: startOfDay, lte: endOfDay },
      },
      select: { id: true },
      orderBy: { created_at: 'desc' },
    });
    if (alreadySent) {
      return {
        success: true,
        skipped: true,
        message: 'Este grupo já recebeu a notícia hoje. Envio ignorado para evitar duplicidade.',
        configuredTitle: target.configuredTitle,
        group: resolvedGroup,
        matchedExactly: Boolean(target.exactMatch),
      };
    }

    const result = await this.sendLatestNewsAndQuiz(
      resolvedGroup.id,
      'GROUP',
      teacherId,
      options?.groupLevel
    );

    return {
      ...result,
      configuredTitle: target.configuredTitle,
      group: resolvedGroup,
      matchedExactly: Boolean(target.exactMatch),
    };
  }

  async dispatchNews(
    teacherId: string,
    options?: {
      sendPrivate?: boolean;
      sendGroup?: boolean;
      groupTitle?: string;
      groupId?: string;
      groupLevel?: string;
    },
  ) {
    const sendPrivate = options?.sendPrivate ?? true;
    const sendGroup = options?.sendGroup ?? true;

    if (!sendPrivate && !sendGroup) {
      throw new BadRequestException(
        'Selecione pelo menos um destino para o disparo da notícia.',
      );
    }

    const jobId = randomUUID();

    void (async () => {
      this.logger.log(
        `[DISPATCH][${jobId}] Iniciando disparo (teacherId=${teacherId}) private=${sendPrivate} group=${sendGroup}`,
      );

      const result: {
        success: boolean;
        private?: any;
        group?: any;
        errors?: Array<{ scope: 'private' | 'group'; message: string }>;
      } = { success: true, errors: [] };

      if (sendPrivate) {
        try {
          result.private = await this.broadcastPrivate(teacherId);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(`[DISPATCH][${jobId}] Falha no privado: ${message}`);
          result.errors?.push({ scope: 'private', message });
          result.success = false;
        }
      }

      if (sendGroup) {
        try {
          result.group = await this.sendLatestNewsToConfiguredGroup(teacherId, {
            title: options?.groupTitle,
            groupId: options?.groupId,
            groupLevel: options?.groupLevel,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(`[DISPATCH][${jobId}] Falha no grupo: ${message}`);
          result.errors?.push({ scope: 'group', message });
          result.success = false;
        }
      }

      this.logger.log(
        `[DISPATCH][${jobId}] Finalizado | success=${result.success} | private=${Boolean(
          result.private,
        )} | group=${Boolean(result.group)} | errors=${result.errors?.length || 0}`,
      );
    })();

    return {
      success: true,
      jobId,
      message: 'Disparo iniciado. As mensagens serão enviadas em segundo plano.',
    };
  }

  @Cron(CronExpression.EVERY_MINUTE, {
    timeZone: process.env.NEWS_DAILY_TIMEZONE || 'America/Sao_Paulo',
  })
  async handleNewsAutomationTick() {
    const timeZone = process.env.NEWS_DAILY_TIMEZONE || 'America/Sao_Paulo';
    const hhmm = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone,
    }).format(new Date());

    let teachers: Array<{
      id: string;
      messageSettings: {
        news_capture_time: string;
        private_news_send_time: string;
        group_news_send_time: string;
        auto_group_targets: unknown;
      } | null;
    }> = [];
    try {
      teachers = await this.prisma.user.findMany({
        where: { role: 'TEACHER', active: true },
        select: {
          id: true,
          messageSettings: {
            select: {
              news_capture_time: true,
              private_news_send_time: true,
              group_news_send_time: true,
              auto_group_targets: true,
            },
          },
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2022') {
        this.logger.warn(
          `[AUTO] Colunas de horário ainda não existem no banco. Aplique a migration e reinicie o backend. (${error?.meta?.driverAdapterError?.cause?.originalMessage || error?.message || 'P2022'})`,
        );
        return;
      }
      throw error;
    }

    for (const teacher of teachers) {
      const settings = teacher.messageSettings;
      if (!settings) continue;

      const targetsRaw = settings.auto_group_targets;
      const targets = Array.isArray(targetsRaw) ? targetsRaw : [];
      const normalizedTargets = targets
        .map((item: any) => ({
          groupId: String(item?.groupId || item?.id || '').trim(),
          groupLevel: item?.groupLevel ? String(item.groupLevel).trim() : undefined,
        }))
        .filter((item: any) => Boolean(item.groupId));

      const captureDue =
        settings.news_capture_time && settings.news_capture_time === hhmm;
      const privateDue =
        settings.private_news_send_time &&
        settings.private_news_send_time === hhmm;
      const groupDue =
        settings.group_news_send_time &&
        settings.group_news_send_time === hhmm &&
        normalizedTargets.length > 0;

      if (!captureDue && !privateDue && !groupDue) continue;

      const jobId = randomUUID();
      void (async () => {
        this.logger.log(
          `[AUTO][${jobId}] Tick ${hhmm} | teacherId=${teacher.id} | capture=${Boolean(
            captureDue,
          )} private=${Boolean(privateDue)} group=${Boolean(groupDue)}`,
        );

        try {
          if (captureDue) {
            await this.newsService.runDailyNewsAndQuiz({
              teacherId: teacher.id,
              referenceType: 'news_automation_capture',
              referenceId: `${new Date().toISOString()}:${jobId}`,
              metadata: { trigger: 'automation' },
            });
          }

          if (privateDue) {
            await this.broadcastPrivate(teacher.id);
          }

          if (groupDue) {
            const now = new Date();
            const startOfDay = new Date(now);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(now);
            endOfDay.setHours(23, 59, 59, 999);

            for (const target of normalizedTargets) {
              const remoteJid = this.normalizeRemoteJid(target.groupId);
              const alreadySent = await this.prisma.whatsappMessage.findFirst({
                where: {
                  direction: 'OUTGOING',
                  remote_jid: remoteJid,
                  content_kind: 'NEWS',
                  created_at: { gte: startOfDay, lte: endOfDay },
                },
                select: { id: true },
                orderBy: { created_at: 'desc' },
              });
              if (alreadySent) {
                this.logger.log(
                  `[AUTO][${jobId}] Grupo ${remoteJid} já recebeu a notícia hoje. Ignorando para evitar duplicidade.`,
                );
                continue;
              }
              await this.sendLatestNewsAndQuiz(
                target.groupId,
                'GROUP',
                teacher.id,
                target.groupLevel,
              );
            }
          }
        } catch (error) {
          this.logger.error(
            `[AUTO][${jobId}] Falha teacherId=${teacher.id}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      })();
    }
  }

  async broadcastPrivate(teacherId: string) {
    this.logger.log(`[BROADCAST] Iniciando disparo privado para alunos do professor ${teacherId}`);
    const students = await this.prisma.student.findMany({
      where: {
        teacher_id: teacherId,
        active: true,
        receive_private_news: true,
        whatsapp_valid: true,
      },
      select: {
        id: true,
        full_name: true,
        whatsapp_number: true,
        english_level: true,
      },
    });

    this.logger.log(`[BROADCAST] Alunos encontrados para disparo: ${students.length}`);

    if (students.length === 0) {
      return { success: true, count: 0, message: 'Nenhum aluno configurado e válido para receber notícia no privado. (Lembre-se de ativar o envio na tela de alunos)' };
    }

    let settings = await this.prisma.messageSettings.findUnique({
      where: { teacher_id: teacherId },
    });

    if (!settings) {
      const defaultPrivateGreeting = 'Good {{period}}, {{nome}}! 🎉🎉';
      const defaultGroupGreeting = 'Good {{period}}! 🎉🎉';
      const defaultSpeakingIntro =
        "*Welcome to the challenge of the day 👊🏻🚀*\n\nCan you read this news out loud and send an audio here?\n\nVocê pode ler esta notícia em voz alta e enviar um áudio aqui?\n\n*Have a wonderful day and let’s speak English with Talkion 😉👍🏻🗣️🇺🇸🇬🇧*";
      const defaultNewsIntro = "📰 *Let’s go to today’s news!*\n\n📰 *Vamos para a notícia do dia!*";
      const defaultGroupNewsIntro = defaultNewsIntro;
      const defaultGroupQuizHeader =
        "📝 *Quiz do Dia*\n\n🇺🇸 Let’s check your understanding of the news.\n\nHora de testar sua compreensão da notícia.\nResponda com atenção e envie tudo em uma única mensagem. 🚀";
      const defaultPreviousQuizHeader =
        '🗝️ *Gabarito do Quiz Anterior*\n\nConfira as respostas corretas do quiz anterior:';
      const defaultGroupQuizFooter =
        "📩 Responda enviando `A`, `B`, `C` ou no formato `1A`, `2B`, `3C`.\n\n🍀 Boa sorte!";

      settings = await this.prisma.messageSettings.create({
        data: {
          teacher_id: teacherId,
          private_greeting_message: defaultPrivateGreeting,
          speaking_intro_message: defaultSpeakingIntro,
          news_intro_message: defaultNewsIntro,
          group_greeting_message: defaultGroupGreeting,
          group_news_intro_message: defaultGroupNewsIntro,
          group_quiz_header_message: defaultGroupQuizHeader,
          private_greeting_idea: `Você pode montar a saudação inicial com base nesse modelo aqui:\n\n${defaultPrivateGreeting}`,
          private_speaking_intro_idea: `Você pode montar a introdução do desafio de áudio com base nesse modelo aqui:\n\n${defaultSpeakingIntro}`,
          private_news_intro_idea: `Você pode montar a introdução da notícia com base nesse modelo aqui:\n\n${defaultNewsIntro}`,
          group_greeting_idea: `Você pode montar a saudação inicial do grupo com base nesse modelo aqui:\n\n${defaultGroupGreeting}`,
          group_previous_quiz_header_idea: `Você pode montar o cabeçalho do quiz do dia anterior com base nesse modelo aqui:\n\n${defaultPreviousQuizHeader}`,
          group_quiz_header_idea: `Você pode montar o cabeçalho do desafio (quiz) com base nesse modelo aqui:\n\n${defaultGroupQuizHeader}`,
          group_news_intro_idea: `Você pode montar a introdução da notícia no grupo com base nesse modelo aqui:\n\n${defaultGroupNewsIntro}`,
        },
      });
    }

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const sentToday = await this.prisma.whatsappMessage.findMany({
      where: {
        student_id: { in: students.map((s) => s.id) },
        direction: 'OUTGOING',
        content_kind: 'PRIVATE_BROADCAST_NEWS',
        created_at: { gte: startOfDay, lte: endOfDay },
      },
      select: { student_id: true },
      distinct: ['student_id'],
    });
    const sentStudentIds = new Set(
      sentToday.map((m) => m.student_id).filter(Boolean) as string[],
    );
    const studentsToSend = students.filter((s) => !sentStudentIds.has(s.id));
    const skippedCount = students.length - studentsToSend.length;

    this.logger.log(
      `[BROADCAST] Elegíveis hoje: ${studentsToSend.length} | Já enviados hoje (ignorados): ${skippedCount}`,
    );

    if (studentsToSend.length === 0) {
      return {
        success: true,
        count: 0,
        skipped: skippedCount,
        message: 'Todos os alunos já receberam a notícia hoje. Envio ignorado para evitar duplicidade.',
      };
    }

    const getNewsByLevel = async () => {
      const levels = ['LEVEL_1', 'LEVEL_2', 'LEVEL_3'] as const;
      const records = await this.prisma.news.findMany({
        where: {
          teacher_id: teacherId,
          level: { in: levels as any },
          created_at: { gte: startOfDay, lte: endOfDay },
        },
        orderBy: { created_at: 'desc' },
      });

      const byLevel = new Map<string, { title: string; content: string; level: string }>();
      for (const item of records) {
        if (!byLevel.has(item.level)) {
          byLevel.set(item.level, {
            title: item.title,
            content: item.content,
            level: item.level,
          });
        }
      }

      if (byLevel.size < 3) {
        await this.newsService.runDailyNewsAndQuiz({
          teacherId,
          referenceType: 'private_broadcast_autofill',
          referenceId: new Date().toISOString().slice(0, 10),
          metadata: { trigger: 'broadcast_private' },
        });

        const after = await this.prisma.news.findMany({
          where: {
            teacher_id: teacherId,
            level: { in: levels as any },
            created_at: { gte: startOfDay, lte: endOfDay },
          },
          orderBy: { created_at: 'desc' },
        });

        for (const item of after) {
          if (!byLevel.has(item.level)) {
            byLevel.set(item.level, {
              title: item.title,
              content: item.content,
              level: item.level,
            });
          }
        }
      }

      return {
        LEVEL_1: byLevel.get('LEVEL_1') || null,
        LEVEL_2: byLevel.get('LEVEL_2') || null,
        LEVEL_3: byLevel.get('LEVEL_3') || null,
      };
    };

    const newsByLevel = await getNewsByLevel();

    const timeZone = process.env.NEWS_DAILY_TIMEZONE || 'America/Sao_Paulo';
    const hourStr = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      hour12: false,
      timeZone,
    }).format(new Date());
    const hour = Number(hourStr);
    const period =
      hour >= 5 && hour < 12
        ? 'morning'
        : hour >= 12 && hour < 18
          ? 'afternoon'
          : 'evening';

    const modelosDeMensagens = {
      greeting: settings.private_greeting_idea || null,
      challenge: settings.private_speaking_intro_idea || null,
      news_intro: settings.private_news_intro_idea || null,
      news_by_level: newsByLevel,
      quiz_footer_hint:
        'No privado não há quiz, apenas notícia e speaking. Encoraje o aluno a responder com áudio.',
      variables: {
        data: new Date().toLocaleDateString('pt-BR'),
        hora: new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        period,
      },
    };

    const computeVariante = (whatsappNumber: string): 1 | 2 | 3 => {
      const digit = Number(String(whatsappNumber).slice(-1));
      const v = ((Number.isFinite(digit) ? digit : 0) % 3) + 1;
      return v === 1 ? 1 : v === 2 ? 2 : 3;
    };

    let generated: Array<{
      nome: string;
      whatsapp: string;
      mensagens: Array<{ tipo: string; mensagem: string }>;
    }> = [];
    try {
      generated = await this.aiService.generatePrivateBroadcastMessages({
        model: settings.ai_model || 'gpt-4o-mini',
        temperature: settings.ai_temperature ?? 0.7,
        systemPrompt: settings.system_prompt || null,
        modelosDeMensagens,
        totalAlunos: studentsToSend.length,
        alunos: studentsToSend.map((s) => ({
          nome: s.full_name,
          whatsapp: s.whatsapp_number,
          nivel: s.english_level,
          variante: computeVariante(s.whatsapp_number),
        })),
        tracking: {
          teacherId,
          referenceType: 'whatsapp_private_broadcast',
          referenceId: new Date().toISOString(),
          flowType: 'OUTGOING',
        },
      });
    } catch (error) {
      this.logger.error(
        `[BROADCAST][IA] Erro ao gerar mensagens em lote: ${error instanceof Error ? error.message : String(error)}`,
      );
      generated = [];
    }

    const studentsByWhatsapp = new Map<string, (typeof studentsToSend)[number]>();
    for (const student of studentsToSend) {
      studentsByWhatsapp.set(student.whatsapp_number, student);
    }

    const fallbackBlocksForStudent = (student: (typeof studentsToSend)[number]) => {
      const selectedNews =
        (student.english_level === 'LEVEL_1' ? newsByLevel.LEVEL_1 : null) ||
        (student.english_level === 'LEVEL_2' ? newsByLevel.LEVEL_2 : null) ||
        (student.english_level === 'LEVEL_3' ? newsByLevel.LEVEL_3 : null) ||
        newsByLevel.LEVEL_1 ||
        newsByLevel.LEVEL_2 ||
        newsByLevel.LEVEL_3;

      const greeting = `Good ${period}, ${student.full_name}!`;
      const challenge =
        'Can you read this news out loud and send an audio here?\n\nVocê pode ler esta notícia em voz alta e enviar um áudio aqui?';
      const newsIntro = '📰 Let’s go to today’s news!';
      const newsBody = selectedNews
        ? this.formatNewsBodyForWhatsapp(selectedNews.title, selectedNews.content)
        : '';

      return [
        { tipo: 'GREETING', mensagem: greeting },
        { tipo: 'SPEAKING_INTRO', mensagem: challenge },
        { tipo: 'NEWS_INTRO', mensagem: newsIntro },
        { tipo: 'NEWS', mensagem: newsBody },
      ];
    };

    const requiredOrder = ['GREETING', 'SPEAKING_INTRO', 'NEWS_INTRO', 'NEWS'] as const;

    let count = 0;
    const processed = new Set<string>();
    for (const entry of generated) {
      const student = studentsByWhatsapp.get(entry.whatsapp);
      if (!student) {
        this.logger.warn(
          `[BROADCAST][IA] WhatsApp retornado sem correspondência: "${entry.whatsapp}" (nome: "${entry.nome}").`,
        );
        continue;
      }

      try {
        processed.add(student.whatsapp_number);
        const byType = new Map<string, string>();
        for (const block of entry.mensagens || []) {
          if (block?.tipo && typeof block.mensagem === 'string') {
            if (!byType.has(String(block.tipo))) {
              byType.set(String(block.tipo), block.mensagem.trim());
            }
          }
        }

        const fallbackBlocks = fallbackBlocksForStudent(student);
        const fallbackByType = new Map<string, string>();
        for (const b of fallbackBlocks) {
          fallbackByType.set(b.tipo, b.mensagem);
        }

        for (const tipo of requiredOrder) {
          const text =
            tipo === 'NEWS'
              ? String(fallbackByType.get('NEWS') || '').trim()
              : String(byType.get(tipo) || fallbackByType.get(tipo) || '').trim();
          if (!text) continue;

          await this.sendMessage(teacherId, student.whatsapp_number, text, {
            studentId: student.id,
            relatedNewsId: null,
            contentKind: `PRIVATE_BROADCAST_${tipo}`,
          });
          count++;
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (error) {
        this.logger.error(
          `[BROADCAST] Erro ao enviar para ${student.whatsapp_number}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const missingStudents = studentsToSend.filter((s) => !processed.has(s.whatsapp_number));
    if (missingStudents.length > 0) {
      this.logger.warn(
        `[BROADCAST][IA] ${missingStudents.length} aluno(s) ficaram sem retorno da IA. Enviando fallback por blocos.`,
      );
      for (const student of missingStudents) {
        try {
          const blocks = fallbackBlocksForStudent(student);
          for (const block of blocks) {
            const text = String(block.mensagem || '').trim();
            if (!text) continue;
            await this.sendMessage(teacherId, student.whatsapp_number, text, {
              studentId: student.id,
              relatedNewsId: null,
              contentKind: `PRIVATE_BROADCAST_FALLBACK_${block.tipo}`,
            });
            count++;
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        } catch (error) {
          this.logger.error(
            `[BROADCAST] Erro ao enviar fallback para ${student.whatsapp_number}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }

    return { success: true, count, skipped: skippedCount, message: 'Disparo finalizado.' };
  }

  async sendLatestNewsAndQuiz(
    numberOrGroupId: string,
    mode: 'GROUP' | 'PRIVATE' = 'PRIVATE',
    providedTeacherId?: string,
    providedGroupLevel?: string,
  ) {
    this.logger.log(`[OUTBOUND] Iniciando fluxo de envio de notícia e quiz para ${numberOrGroupId} (Modo: ${mode})`);
    
    const targetNumber = numberOrGroupId;
    const isGroupTarget =
      mode === 'GROUP' ||
      (mode !== 'PRIVATE' && targetNumber.includes('@g.us'));

    const student = await this.prisma.student.findUnique({
      where: { whatsapp_number: targetNumber },
    });

    const teacherId = providedTeacherId || student?.teacher_id;
    if (!teacherId) throw new Error('teacherId is required to send messages');

    // Busca as configurações de mensagens do professor, ou cria se não existir
    let settings = await this.prisma.messageSettings.findUnique({
      where: { teacher_id: teacherId }
    });

    if (!settings) {
      const defaultPrivateGreeting = 'Good {{period}}, {{nome}}! 🎉🎉';
      const defaultGroupGreeting = 'Good {{period}}! 🎉🎉';
      const defaultSpeakingIntro =
        "*Welcome to the challenge of the day 👊🏻🚀*\n\nCan you read this news out loud and send an audio here?\n\nVocê pode ler esta notícia em voz alta e enviar um áudio aqui?\n\n*Have a wonderful day and let’s speak English with Talkion 😉👍🏻🗣️🇺🇸🇬🇧*";
      const defaultNewsIntro = "📰 *Let’s go to today’s news!*\n\n📰 *Vamos para a notícia do dia!*";
      const defaultGroupNewsIntro = defaultNewsIntro;
      const defaultGroupQuizHeader =
        "📝 *Quiz do Dia*\n\n🇺🇸 Let’s check your understanding of the news.\n\nHora de testar sua compreensão da notícia.\nResponda com atenção e envie tudo em uma única mensagem. 🚀";
      const defaultPreviousQuizHeader =
        '🗝️ *Gabarito do Quiz Anterior*\n\nConfira as respostas corretas do quiz anterior:';
      const defaultGroupQuizFooter =
        "📩 Responda enviando `A`, `B`, `C` ou no formato `1A`, `2B`, `3C`.\n\n🍀 Boa sorte!";

      settings = await this.prisma.messageSettings.create({
        data: {
          teacher_id: teacherId,
          private_greeting_message: defaultPrivateGreeting,
          speaking_intro_message: defaultSpeakingIntro,
          news_intro_message: defaultNewsIntro,
          group_greeting_message: defaultGroupGreeting,
          group_news_intro_message: defaultGroupNewsIntro,
          group_quiz_header_message: defaultGroupQuizHeader,
          private_greeting_idea: `Você pode montar a saudação inicial com base nesse modelo aqui:\n\n${defaultPrivateGreeting}`,
          private_speaking_intro_idea: `Você pode montar a introdução do desafio de áudio com base nesse modelo aqui:\n\n${defaultSpeakingIntro}`,
          private_news_intro_idea: `Você pode montar a introdução da notícia com base nesse modelo aqui:\n\n${defaultNewsIntro}`,
          group_greeting_idea: `Você pode montar a saudação inicial do grupo com base nesse modelo aqui:\n\n${defaultGroupGreeting}`,
          group_previous_quiz_header_idea: `Você pode montar o cabeçalho do quiz do dia anterior com base nesse modelo aqui:\n\n${defaultPreviousQuizHeader}`,
          group_quiz_header_idea: `Você pode montar o cabeçalho do desafio (quiz) com base nesse modelo aqui:\n\n${defaultGroupQuizHeader}`,
          group_quiz_footer_idea: `Você pode montar o rodapé do quiz com base nesse modelo aqui:\n\n${defaultGroupQuizFooter}`,
          group_news_intro_idea: `Você pode montar a introdução da notícia no grupo com base nesse modelo aqui:\n\n${defaultGroupNewsIntro}`,
        }
      });
    }

    // Configura um tracking opcional para a busca da notícia
    const baseTracking = { teacherId };
    
    // Se for grupo e tiver level, usamos o level fornecido, senão usamos o level do aluno (se for privado)
    const targetLevel = (isGroupTarget && providedGroupLevel) ? providedGroupLevel : student?.english_level;
    
    const latestNews = await this.findLatestNewsForTarget(targetLevel, baseTracking);

    if (!latestNews) {
      throw new Error('Nenhuma notícia disponível para envio.');
    }

    let quizId: string | null = null;
    let previousQuizId: string | null = null;

    const timeZone = process.env.NEWS_DAILY_TIMEZONE || 'America/Sao_Paulo';
    const hourStr = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      hour12: false,
      timeZone,
    }).format(new Date());
    const hour = Number(hourStr);
    const period =
      hour >= 5 && hour < 12
        ? 'morning'
        : hour >= 12 && hour < 18
          ? 'afternoon'
          : 'evening';

    const variables = {
      nome: student?.full_name || null,
      telefone: student?.whatsapp_number || null,
      data: new Date().toLocaleDateString('pt-BR'),
      hora: new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      period: period as 'morning' | 'afternoon' | 'evening',
    };

    const renderVars = (text: string) => {
      if (!text) return '';
      return text
        .replace(/{{nome}}/g, variables.nome || '')
        .replace(/{{telefone}}/g, variables.telefone || '')
        .replace(/{{data}}/g, variables.data || '')
        .replace(/{{hora}}/g, variables.hora || '')
        .replace(/{{period}}/g, variables.period || '');
    };

    const getAiMessages = async (input: {
      mode: 'GROUP' | 'PRIVATE';
      quizQuestions?: any;
      previousAnswerKey?: string | null;
    }) => {
      const legacyIdea =
        input.mode === 'GROUP'
          ? settings.group_message_idea
          : settings.private_message_idea;
      const greetingIdea =
        input.mode === 'GROUP'
          ? settings.group_greeting_idea || legacyIdea || null
          : settings.private_greeting_idea || legacyIdea || null;
      const previousQuizHeaderIdea =
        input.mode === 'GROUP'
          ? settings.group_previous_quiz_header_idea || legacyIdea || null
          : null;
      const challengeIdea =
        input.mode === 'GROUP'
          ? settings.group_quiz_header_idea || legacyIdea || null
          : settings.private_speaking_intro_idea || legacyIdea || null;
      const quizFooterIdea =
        input.mode === 'GROUP'
          ? settings.group_quiz_footer_idea || legacyIdea || null
          : null;
      const newsIntroIdea =
        input.mode === 'GROUP'
          ? settings.group_news_intro_idea || legacyIdea || null
          : settings.private_news_intro_idea || legacyIdea || null;
      const defaultPreviousQuizHeader =
        '🗝️ *Gabarito do Quiz Anterior*\n\nConfira as respostas corretas do quiz anterior:';
      const templates =
        input.mode === 'GROUP'
          ? {
              greeting: renderVars(settings.group_greeting_message),
              previousQuizHeader: defaultPreviousQuizHeader,
              newsIntro: renderVars(settings.group_news_intro_message),
              quizHeader: renderVars(settings.group_quiz_header_message),
              quizFooter: settings.group_quiz_footer_message,
            }
          : {
              greeting: renderVars(settings.private_greeting_message),
              speakingIntro: renderVars(settings.speaking_intro_message),
              newsIntro: renderVars(settings.news_intro_message),
            };

      return this.aiService.generateWhatsappOutboundMessages({
        mode: input.mode,
        model: settings.ai_model || 'gpt-4o-mini',
        temperature: settings.ai_temperature ?? 0.7,
        systemPrompt: settings.system_prompt || null,
        ideas: {
          greetingIdea,
          previousQuizHeaderIdea,
          challengeIdea,
          quizFooterIdea,
          newsIntroIdea,
        },
        variables,
        templates: templates as any,
        content: {
          newsTitle: latestNews.title,
          newsText: latestNews.content,
          level: latestNews.level,
          quizQuestions: input.quizQuestions,
          previousAnswerKey: input.previousAnswerKey || null,
        },
        tracking: {
          teacherId,
          studentId: student?.id || null,
          newsId: latestNews.id,
          referenceType: 'whatsapp_outbound',
          referenceId: `${input.mode}:${new Date().toISOString()}`,
          remoteJid: this.normalizeRemoteJid(targetNumber),
          flowType: 'OUTGOING',
        },
      });
    };

    if (isGroupTarget) {
      const quizResult = await this.quizService.generateQuizForNews(latestNews.id, baseTracking);
      const previousQuiz = await this.findPreviousQuizForAnswerKey(latestNews.id);
      const answerKeyMessage = this.formatAnswerKeyForWhatsapp(previousQuiz);
      let aiMessages: Array<{ kind: string; text: string }> = [];
      try {
        aiMessages = await getAiMessages({
          mode: 'GROUP',
          quizQuestions: quizResult.quiz.questions,
          previousAnswerKey: answerKeyMessage || null,
        });
      } catch (error) {
        this.logger.warn(
          `[OUTBOUND][IA] Falha ao gerar mensagens via IA (GROUP). Usando templates padrão. ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      const byKind = new Map<string, string>();
      for (const msg of aiMessages) {
        if (!byKind.has(msg.kind)) {
          byKind.set(msg.kind, msg.text);
        }
      }

      const greetingMessage =
        byKind.get('GROUP_GREETING') || renderVars(settings.group_greeting_message);
      const answerKeyHeaderMessage =
        byKind.get('ANSWER_KEY_HEADER') ||
        '🗝️ *Gabarito do Quiz Anterior*\n\nConfira as respostas corretas do quiz anterior:';
      const newsIntroMessage =
        byKind.get('NEWS_INTRO') || renderVars(settings.group_news_intro_message);
      const newsMessage = this.formatNewsBodyForWhatsapp(
        latestNews.title,
        latestNews.content,
      );
      const quizHeaderMessage =
        byKind.get('QUIZ_HEADER') || renderVars(settings.group_quiz_header_message);
      const quizFooterMessage =
        byKind.get('QUIZ_FOOTER') || renderVars(settings.group_quiz_footer_message);
      const quizMessage =
        byKind.get('QUIZ') ||
        this.formatQuizBodyForWhatsapp(
          quizResult.quiz.questions as QuizQuestion[],
          '',
        );

      quizId = quizResult.quiz.id;
      previousQuizId = previousQuiz?.id || null;

      await this.sendMessage(teacherId, targetNumber, greetingMessage, {
        studentId: student?.id || null,
        relatedNewsId: latestNews.id,
        relatedQuizId: quizResult.quiz.id,
        contentKind: 'GROUP_GREETING',
      });

      if (answerKeyMessage) {
        await this.sendMessage(teacherId, targetNumber, answerKeyHeaderMessage, {
          studentId: student?.id || null,
          relatedNewsId: previousQuiz?.news_id || null,
          relatedQuizId: previousQuiz?.id || null,
          contentKind: 'ANSWER_KEY_HEADER',
        });
        await this.sendMessage(teacherId, targetNumber, answerKeyMessage, {
          studentId: student?.id || null,
          relatedNewsId: previousQuiz?.news_id || null,
          relatedQuizId: previousQuiz?.id || null,
          contentKind: 'ANSWER_KEY',
        });
      }

      await this.sendMessage(teacherId, targetNumber, newsIntroMessage, {
        studentId: student?.id || null,
        relatedNewsId: latestNews.id,
        contentKind: 'NEWS_INTRO',
      });
      await this.sendMessage(teacherId, targetNumber, newsMessage, {
        studentId: student?.id || null,
        relatedNewsId: latestNews.id,
        contentKind: 'NEWS',
      });
      await this.sendMessage(teacherId, targetNumber, quizHeaderMessage, {
        studentId: student?.id || null,
        relatedNewsId: latestNews.id,
        relatedQuizId: quizResult.quiz.id,
        contentKind: 'QUIZ_HEADER',
      });
      await this.sendMessage(teacherId, targetNumber, quizMessage, {
        studentId: student?.id || null,
        relatedNewsId: latestNews.id,
        relatedQuizId: quizResult.quiz.id,
        contentKind: 'QUIZ',
      });
      if (quizFooterMessage?.trim()) {
        await this.sendMessage(teacherId, targetNumber, quizFooterMessage, {
          studentId: student?.id || null,
          relatedNewsId: latestNews.id,
          relatedQuizId: quizResult.quiz.id,
          contentKind: 'QUIZ_FOOTER',
        });
      }
    } else {
      let aiMessages: Array<{ kind: string; text: string }> = [];
      try {
        aiMessages = await getAiMessages({
          mode: 'PRIVATE',
        });
      } catch (error) {
        this.logger.warn(
          `[OUTBOUND][IA] Falha ao gerar mensagens via IA (PRIVATE). Usando templates padrão. ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      const byKind = new Map<string, string>();
      for (const msg of aiMessages) {
        if (!byKind.has(msg.kind)) {
          byKind.set(msg.kind, msg.text);
        }
      }

      const greetingMessage =
        byKind.get('PRIVATE_GREETING') || renderVars(settings.private_greeting_message);
      const speakingIntroMessage =
        byKind.get('SPEAKING_INTRO') || renderVars(settings.speaking_intro_message);
      const newsIntroMessage =
        byKind.get('NEWS_INTRO') || renderVars(settings.news_intro_message);
      const newsMessage = this.formatNewsBodyForWhatsapp(
        latestNews.title,
        latestNews.content,
      );

      await this.sendMessage(teacherId, targetNumber, greetingMessage, {
        studentId: student?.id || null,
        relatedNewsId: latestNews.id,
        contentKind: 'PRIVATE_GREETING',
      });
      await this.sendMessage(teacherId, targetNumber, speakingIntroMessage, {
        studentId: student?.id || null,
        relatedNewsId: latestNews.id,
        contentKind: 'SPEAKING_INTRO',
      });
      await this.sendMessage(teacherId, targetNumber, newsIntroMessage, {
        studentId: student?.id || null,
        relatedNewsId: latestNews.id,
        contentKind: 'NEWS_INTRO',
      });
      await this.sendMessage(teacherId, targetNumber, newsMessage, {
        studentId: student?.id || null,
        relatedNewsId: latestNews.id,
        contentKind: 'NEWS',
      });
    }

    return {
      sent: true,
      targetNumber,
      newsId: latestNews.id,
      quizId,
      previousQuizId,
      level: latestNews.level,
      targetType: isGroupTarget ? 'GROUP' : 'PRIVATE',
    };
  }

  private extractInstanceNameFromPayload(payload: any): string | null {
    if (typeof payload?.instance === 'string') return payload.instance;
    if (typeof payload?.data?.instance === 'string') return payload.data.instance;
    if (typeof payload?.instanceData?.instanceName === 'string') return payload.instanceData.instanceName;
    if (typeof payload?.instanceData?.name === 'string') return payload.instanceData.name;
    return null;
  }

  /**
   * Processa os webhooks recebidos da Evolution API.
   */
  async handleWebhook(payload: any) {
    const instanceName = this.extractInstanceNameFromPayload(payload);
    if (!instanceName) {
      this.logger.warn('[WEBHOOK] Payload recebido sem instanceName');
      return { processed: false, reason: 'Sem instanceName' };
    }

    const event = this.normalizeEvent(payload?.event);

    if (event === 'qrcode.updated') {
      const qrCode = this.extractQrCode(payload);
      if (qrCode) {
        this.setCachedQrCode(instanceName, qrCode);
      }

      return { processed: true, event };
    }

    if (event === 'connection.update') {
      const connectionStatus = this.normalizeConnectionStatus(
        payload?.data?.state || payload?.data?.status || 'unknown',
      );

      if (connectionStatus === 'open') {
        this.qrCodeCache.delete(instanceName);
        this.resetAllSyncStates('idle', 'WhatsApp conectado. Sincronize os grupos manualmente.');
      } else {
        this.resetAllSyncStates(
          'waiting_connection',
          'Conecte o WhatsApp para iniciar a sincronizacao.',
        );
      }

      this.logger.log(
        `[STATUS] Conexao WhatsApp atualizada: ${connectionStatus}`,
      );

      return {
        processed: true,
        event,
        connectionStatus,
      };
    }

    if (event !== 'messages.upsert') {
      return { processed: false, event };
    }

    const data = payload?.data || payload;
    const messageData = data?.message;
    const remoteJid = data?.key?.remoteJid;
    const fromMe = data?.key?.fromMe;
    const textContent = this.extractTextContent(messageData);
    const hasAudio = Boolean(messageData?.audioMessage);
    const incomingMessageId = this.extractIncomingMessageId(data);
    const quotedMessageId = this.extractQuotedMessageId(data);

    if (!messageData || typeof remoteJid !== 'string') {
      return { processed: false, reason: 'Mensagem ignorada' };
    }

    if (
      fromMe &&
      !this.shouldProcessSelfMessage({
        textContent,
        hasAudio,
      })
    ) {
      return { processed: false, reason: 'Mensagem própria ignorada' };
    }

    const isGroup = remoteJid.includes('@g.us');
    const senderJid = isGroup ? data?.key?.participant : remoteJid;

    if (typeof senderJid !== 'string') {
      return { processed: false, reason: 'Remetente não identificado' };
    }

    const whatsappNumber = senderJid.split('@')[0];
    const student = await this.prisma.student.findUnique({
      where: { whatsapp_number: whatsappNumber },
    });

    if (!student) {
      this.logger.warn(
        `[ENTRADA][IGNORADA] Aluno nao encontrado para o numero ${whatsappNumber}.`,
      );
      return { processed: false, reason: 'Aluno não encontrado' };
    }

    if (student.active === false) {
      this.logger.warn(
        `[ENTRADA][IGNORADA] Aluno inativo: ${this.formatStudentLog(student as any)}.`,
      );
      return { processed: false, reason: 'Aluno inativo' };
    }

    const parsedAnswers = textContent ? this.parseQuizAnswers(textContent) : [];
    const identifiedType = hasAudio
      ? 'audio'
      : parsedAnswers.length > 0
        ? 'quiz'
        : 'texto';

    this.logger.log(
      `[ENTRADA] Mensagem recebida de ${this.formatStudentLog(student)} | origem: ${
        isGroup ? 'grupo' : 'privado'
      } | tipo identificado: ${identifiedType}${
        quotedMessageId ? ` | respondendo mensagem: ${quotedMessageId}` : ''
      }`,
    );

    await this.saveMessageToDb(
      student.id,
      isGroup,
      textContent || '[Audio recebido]',
      null,
      {
        remoteJid,
        externalMessageId: incomingMessageId,
        quotedMessageId,
        contentKind: hasAudio ? 'AUDIO' : parsedAnswers.length > 0 ? 'QUIZ' : 'TEXT',
      },
    );

    if (hasAudio) {
      await this.handleAudioMessage(
        instanceName,
        student,
        remoteJid,
        data,
        incomingMessageId,
        quotedMessageId,
      );
      return { processed: true, event, type: 'audio' };
    }

    if (textContent) {
      await this.handleTextMessage(
        student,
        remoteJid,
        textContent,
        parsedAnswers,
        quotedMessageId,
      );
      return { processed: true, event, type: 'text' };
    }

    return { processed: false, reason: 'Sem conteúdo útil' };
  }

  private async handleTextMessage(
    student: StudentContext,
    remoteJid: string,
    text: string,
    preParsedAnswers?: ParsedQuizAnswer[],
    quotedMessageId?: string | null,
  ) {
    const parsedAnswers = preParsedAnswers || this.parseQuizAnswers(text);
    if (parsedAnswers.length === 0) {
      return;
    }

    const referencedMessage = await this.resolveReferencedMessage(quotedMessageId);
    let quizResolutionSource = 'fallback';
    let latestQuiz = referencedMessage?.related_quiz_id
      ? await this.prisma.quiz.findUnique({
          where: { id: referencedMessage.related_quiz_id },
        })
      : null;

    if (latestQuiz) {
      quizResolutionSource = 'mensagem do quiz citada';
    }

    if (!latestQuiz && referencedMessage?.related_news_id) {
      latestQuiz = await this.prisma.quiz.findFirst({
        where: { news_id: referencedMessage.related_news_id },
        orderBy: { created_at: 'desc' },
      });

      if (latestQuiz) {
        quizResolutionSource = 'mensagem da noticia citada';
      }
    }

    if (!latestQuiz) {
      latestQuiz = await this.prisma.quiz.findFirst({
        where: { teacher_id: student.teacher_id },
        orderBy: { created_at: 'desc' },
      });
    }

    this.logger.log(
      `[QUIZ][RESOLUCAO] Quiz resolvido para ${this.formatStudentLog(student)} | origem: ${quizResolutionSource}${
        quotedMessageId ? ` | mensagem citada: ${quotedMessageId}` : ''
      }`,
    );

    if (!latestQuiz) {
      this.logger.warn(
        `[QUIZ][AVISO] Resposta recebida de ${this.formatStudentLog(student)}, mas ainda nao existe quiz para correcao.`,
      );
      return;
    }

    const questionsArray = Array.isArray(latestQuiz.questions)
      ? (latestQuiz.questions as QuizQuestion[])
      : [];

    if (questionsArray.length === 0) {
      this.logger.warn(
        `[QUIZ][AVISO] Quiz ${latestQuiz.id} sem perguntas validas para correcao.`,
      );
      return;
    }

    const existingSubmission = await this.prisma.quizAnswer.findFirst({
      where: {
        student_id: student.id,
        quiz_id: latestQuiz.id,
      },
    });

    if (existingSubmission) {
      this.logger.log(
        `[QUIZ][IGNORADA] Resposta de ${this.formatStudentLog(student)} | quiz ${latestQuiz.id} | motivo: aluno ja enviou respostas.`,
      );
      return;
    }

    const correctLetters = questionsArray.map((question, index) => {
      const correctLetter = this.extractOptionLetter(
        question.correct_answer,
        question.options,
      );

      if (!correctLetter) {
        this.logger.warn(
          `[QUIZ][AVISO] Pergunta ${index + 1} do quiz ${latestQuiz.id} nao possui alternativa correta valida.`,
        );
      }

      return correctLetter || '-';
    });

    if (correctLetters.includes('-')) {
      return;
    }

    const normalizedAnswers = new Array<string>(questionsArray.length).fill('-');
    const usedQuestionIndexes = new Set<number>();

    for (const [answerPosition, parsedAnswer] of parsedAnswers.entries()) {
      const questionIndex =
        parsedAnswer.questionIndex !== undefined
          ? parsedAnswer.questionIndex
          : answerPosition;

      if (questionIndex < 0 || questionIndex >= questionsArray.length) {
        this.logger.warn(
          `[QUIZ][IGNORADA] Resposta de ${this.formatStudentLog(student)} fora do intervalo | pergunta ${questionIndex + 1} | quiz ${latestQuiz.id}.`,
        );
        return;
      }

      if (usedQuestionIndexes.has(questionIndex)) {
        this.logger.warn(
          `[QUIZ][IGNORADA] Resposta duplicada de ${this.formatStudentLog(student)} | pergunta ${questionIndex + 1} | quiz ${latestQuiz.id}.`,
        );
        return;
      }

      usedQuestionIndexes.add(questionIndex);
      normalizedAnswers[questionIndex] = parsedAnswer.selectedAnswer;
    }

    const isCorrect =
      normalizedAnswers.every((answer) => answer !== '-') &&
      normalizedAnswers.every(
        (answer, index) => answer === correctLetters[index],
      );

    await this.prisma.quizAnswer.create({
      data: {
        student_id: student.id,
        quiz_id: latestQuiz.id,
        question_id: 'FULL_QUIZ',
        selected_answer: normalizedAnswers.join(','),
        submitted_text: text,
        correct_answer: correctLetters.join(','),
        is_correct: isCorrect,
      },
    });

    this.logger.log(
      `[QUIZ] Resposta registrada para ${this.formatStudentLog(student)} | quiz ${latestQuiz.id} | respostas: ${normalizedAnswers.join(',')} | gabarito: ${correctLetters.join(',')} | acertou tudo: ${isCorrect ? 'sim' : 'nao'}`,
    );
  }

  private async handleAudioMessage(
    instanceName: string,
    student: StudentContext,
    remoteJid: string,
    messageData: any,
    incomingMessageId?: string | null,
    quotedMessageId?: string | null,
  ) {
    try {
      const mediaResponse = await this.http.post(
        `/chat/getBase64FromMediaMessage/${instanceName}`,
        { message: messageData },
      );

      const base64Audio = mediaResponse.data?.base64;
      if (!base64Audio) {
        throw new Error('Não foi possível obter o áudio em base64');
      }

      const referencedMessage = await this.resolveReferencedMessage(quotedMessageId);
      const latestNews = await this.resolveNewsForIncomingMessage(
        student,
        referencedMessage?.related_news_id || null,
      );

      if (!latestNews) {
        this.logger.warn(
          `[AUDIO][IGNORADO] Audio ignorado para ${this.formatStudentLog(student)} | Nenhuma noticia encontrada.`,
        );
        return;
      }

      const existingSubmissionForNews = await this.prisma.audioSubmission.findFirst({
        where: {
          student_id: student.id,
          news_id: latestNews.id,
        },
        orderBy: {
          created_at: 'desc',
        },
        select: {
          id: true,
          created_at: true,
        },
      });

      if (existingSubmissionForNews) {
        this.logger.log(
          `[AUDIO][IGNORADO] Novo audio ignorado para ${this.formatStudentLog(student)} | ja existe envio para o desafio atual (${existingSubmissionForNews.id})`,
        );
        return;
      }

      const feedback = await this.aiService.evaluateSpeaking(
        latestNews.content,
        base64Audio,
        messageData?.audioMessage?.mimetype,
        {
          teacherId: student.teacher_id,
          studentId: student.id,
          newsId: latestNews.id,
          remoteJid,
          contentKind: 'SPEAKING_AUDIO',
          flowType: 'INCOMING',
          audioSeconds: Number(
            messageData?.audioMessage?.seconds ??
              messageData?.audioMessage?.duration ??
              0,
          ),
          metadata: {
            quotedMessageId: quotedMessageId || null,
            incomingMessageId: incomingMessageId || null,
          },
        },
      );

      const submission = await this.prisma.audioSubmission.create({
        data: {
          student_id: student.id,
          news_id: latestNews.id,
          audio_url: base64Audio,
          transcription: feedback.transcription,
        }
      });

      await this.prisma.speakingFeedback.create({
        data: {
          audio_submission_id: submission.id,
          score: feedback.score || 0,
          feedback: feedback.feedback || 'Sem feedback',
          mistakes: feedback.mistakes || [],
        }
      });

      const strengthsText = feedback.strengths?.length
        ? feedback.strengths.map((item) => `- ${item}`).join('\n')
        : '- Boa tentativa.';
      const improvementsText = feedback.improvements?.length
        ? feedback.improvements.map((item) => `- ${item}`).join('\n')
        : '- Continue praticando para ganhar mais clareza.';
      const tipsText = feedback.tips?.length
        ? feedback.tips.map((item) => `- ${item}`).join('\n')
        : '- Leia a notícia em voz alta mais uma vez e grave novamente.';
      const mistakesText = feedback.mistakes?.length
        ? feedback.mistakes.map((item) => `- ${item}`).join('\n')
        : '- Nenhum erro principal identificado.';

      const replyText = [
        '🎤 *Feedback de Speaking*',
        '',
        `⭐ *Nota:* ${feedback.score}/10`,
        '',
        feedback.feedback,
        '',
        '✅ *O que você fez bem:*',
        strengthsText,
        '',
        '🛠️ *O que precisa melhorar:*',
        improvementsText,
        '',
        '💡 *Como falar melhor:*',
        tipsText,
        '',
        '🔎 *Palavras ou trechos para corrigir:*',
        mistakesText,
      ].join('\n');
      await this.sendMessage(student.teacher_id as string, remoteJid, replyText, {
        studentId: student.id,
        remoteJid,
        relatedNewsId: latestNews.id,
        contentKind: 'SPEAKING_FEEDBACK',
        quotedMessageId: quotedMessageId || null,
      });

      this.logger.log(
        `[AUDIO][SAIDA] Feedback de speaking enviado para ${this.formatStudentLog(student)} | noticia ${latestNews.id} | nota: ${feedback.score}/10`,
      );

    } catch (error) {
      this.logger.error(
        `[AUDIO][ERRO] Falha ao processar audio de ${this.formatStudentLog(student)}`,
        this.describeError(error),
      );
      await this.sendMessage(
        student.teacher_id as string,
        remoteJid,
        'Desculpe, ocorreu um erro ao avaliar o seu audio.',
        {
          studentId: student.id,
          remoteJid,
          contentKind: 'ERROR',
          quotedMessageId: quotedMessageId || null,
        },
      );
    }
  }

  private async saveMessageToDb(
    studentId: string,
    isGroup: boolean,
    content: string,
    mediaUrl: string | null,
    metadata?: {
      remoteJid?: string | null;
      externalMessageId?: string | null;
      quotedMessageId?: string | null;
      relatedNewsId?: string | null;
      relatedQuizId?: string | null;
      contentKind?: string | null;
    },
  ) {
    try {
      if (metadata?.externalMessageId) {
        const existingMessage = await this.prisma.whatsappMessage.findFirst({
          where: { external_message_id: metadata.externalMessageId },
        });

        if (existingMessage) {
          return;
        }
      }

      await this.prisma.whatsappMessage.create({
        data: {
          student_id: studentId,
          message_type: isGroup ? 'GROUP' : 'PRIVATE',
          direction: 'INCOMING',
          content: content || '[Mídia recebida]',
          media_url: mediaUrl,
          remote_jid: metadata?.remoteJid || null,
          external_message_id: metadata?.externalMessageId || null,
          quoted_message_id: metadata?.quotedMessageId || null,
          related_news_id: metadata?.relatedNewsId || null,
          related_quiz_id: metadata?.relatedQuizId || null,
          content_kind: metadata?.contentKind || null,
        }
      });
    } catch (error) {
      this.logger.error('[DB][ERRO] Falha ao salvar mensagem no banco de dados', error);
    }
  }

  private async saveOutgoingMessageToDb(input: {
    studentId: string | null;
    remoteJid: string | null;
    relatedNewsId: string | null;
    relatedQuizId: string | null;
    contentKind: string | null;
    quotedMessageId: string | null;
    externalMessageId: string | null;
    content: string;
  }) {
    try {
      if (input.externalMessageId) {
        const existingMessage = await this.prisma.whatsappMessage.findFirst({
          where: { external_message_id: input.externalMessageId },
        });

        if (existingMessage) {
          return;
        }
      }

      await this.prisma.whatsappMessage.create({
        data: {
          student_id: input.studentId,
          message_type: input.remoteJid?.includes('@g.us') ? 'GROUP' : 'PRIVATE',
          direction: 'OUTGOING',
          content: input.content,
          media_url: null,
          remote_jid: input.remoteJid,
          external_message_id: input.externalMessageId,
          quoted_message_id: input.quotedMessageId,
          related_news_id: input.relatedNewsId,
          related_quiz_id: input.relatedQuizId,
          content_kind: input.contentKind,
        },
      });
    } catch (error) {
      this.logger.error(
        '[DB][ERRO] Falha ao salvar mensagem enviada no banco de dados',
        error,
      );
    }
  }

  // Funções legadas removidas pois agora usamos do banco
  // private formatPrivateGreetingForWhatsapp()
  // private formatGroupGreetingForWhatsapp()
  // private formatPrivateSpeakingIntroForWhatsapp()
  // private formatTodayNewsIntroForWhatsapp()

  private formatNewsBodyForWhatsapp(title: string, content: string) {
    const cleanTitle = title.replace(/\s*[–-]\s*level\s*\d+\s*$/i, '').trim();
    const difficultWordsMatch = content.match(/\n\nDifficult words:\s*([\s\S]*)$/i);
    const difficultWordsRaw = difficultWordsMatch?.[1]?.trim() || '';
    const newsBody = content.replace(/\n\nDifficult words:\s*[\s\S]*$/i, '').trim();
    const parsedWords = this.parseDifficultWords(difficultWordsRaw);
    const highlightedNewsBody = this.boldDifficultWordsInText(newsBody, parsedWords);
    const difficultWordsSection = parsedWords.length
      ? [
          '*Difficult Words:*',
          ...parsedWords.map(
            (entry) => `- *${entry.term}*: ${entry.definition}`,
          ),
        ].join('\n')
      : '*Difficult Words:*';

    return [`📰 *${cleanTitle}*`, '', highlightedNewsBody, '', difficultWordsSection].join(
      '\n',
    );
  }

  // private formatQuizHeaderForWhatsapp()

  private formatQuizBodyForWhatsapp(questions: QuizQuestion[], footer: string) {
    const blocks = questions.map((question) =>
      [
        question.question,
        ...question.options,
      ].join('\n'),
    );

    return [
      ...blocks.flatMap((block, index) =>
        index === blocks.length - 1 ? [block] : [block, ''],
      ),
      '',
      footer || 'Responda com as opções',
    ].join('\n');
  }

  private getMorningGreeting(emojis: string) {
    const weekdays = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    const weekday = weekdays[new Date().getDay()];
    return `Good morning ${weekday} ${emojis}`;
  }

  private async findLatestNewsForTarget(level?: string, tracking?: any) {
    const teacherId = tracking?.teacherId;
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    let latestNews = await this.prisma.news.findFirst({
      where: {
        teacher_id: teacherId,
        level: level ? level : undefined,
        created_at: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: { created_at: 'desc' },
    });

    if (!latestNews) {
      latestNews = await this.prisma.news.findFirst({
        where: {
          teacher_id: teacherId,
          created_at: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        orderBy: { created_at: 'desc' },
      });
    }

    if (!latestNews) {
      await this.newsService.runDailyNewsAndQuiz({
        ...tracking,
        referenceType: 'news_autofill',
        referenceId: new Date().toISOString(),
        metadata: {
          trigger: 'whatsapp_fallback',
          ...(tracking?.metadata || {}),
        },
      });
      latestNews = await this.prisma.news.findFirst({
        where: {
          teacher_id: teacherId,
          level: level ? level : undefined,
          created_at: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        orderBy: { created_at: 'desc' },
      });
    }

    if (!latestNews) {
      latestNews = await this.prisma.news.findFirst({
        where: { teacher_id: teacherId },
        orderBy: { created_at: 'desc' },
      });
    }

    return latestNews;
  }

  private formatAnswerKeyForWhatsapp(
    quiz:
      | {
          id: string;
          news?: { title?: string | null } | null;
          questions: unknown;
        }
      | null,
  ) {
    if (!quiz || !Array.isArray(quiz.questions)) {
      return null;
    }

    const questions = quiz.questions as QuizQuestion[];
    if (questions.length === 0) {
      return null;
    }

    const answerLines = questions.map((question, index) => {
      const answer = question.correct_answer?.trim() || 'Sem resposta cadastrada';
      return `${index + 1}. ${answer}`;
    });

    const titleLine = quiz.news?.title ? `*Quiz anterior:* ${quiz.news.title}` : '*Respostas do quiz de ontem*';

    return [titleLine, '', ...answerLines].join('\n');
  }

  private parseDifficultWords(rawText: string) {
    if (!rawText) {
      return [] as Array<{ term: string; definition: string }>;
    }

    const matches = [...rawText.matchAll(/([^,]+?)\s*\(([^()]*)\)/g)];
    return matches.map((match) => ({
      term: match[1].trim(),
      definition: match[2].trim(),
    }));
  }

  private async findPreviousQuizForAnswerKey(currentNewsId: string) {
    return this.prisma.quiz.findFirst({
      where: {
        news_id: {
          not: currentNewsId,
        },
      },
      include: {
        news: {
          select: {
            title: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  private boldDifficultWordsInText(
    text: string,
    entries: Array<{ term: string; definition: string }>,
  ) {
    const sortedEntries = [...entries].sort(
      (a, b) => b.term.length - a.term.length,
    );

    return sortedEntries.reduce((formattedText, entry) => {
      const termPattern = this.buildWordVariantPattern(entry.term);
      const regex = new RegExp(
        `(^|[^A-Za-z])(${termPattern})(?=$|[^A-Za-z])`,
        'gi',
      );

      return formattedText.replace(
        regex,
        (_, prefix: string, match: string) => `${prefix}*\`${match}\`*`,
      );
    }, text);
  }

  private buildWordVariantPattern(term: string) {
    const words = term.trim().split(/\s+/);
    const lastWord = words[words.length - 1] || term;
    const baseLastWord = lastWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pluralPattern = this.buildPluralPattern(lastWord);
    const prefixWords = words
      .slice(0, -1)
      .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('\\s+');

    if (!prefixWords) {
      return pluralPattern || baseLastWord;
    }

    return `${prefixWords}\\s+${pluralPattern || baseLastWord}`;
  }

  private buildPluralPattern(word: string) {
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    if (/[^aeiou]y$/i.test(word)) {
      const base = word.slice(0, -1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return `(?:${escapedWord}|${base}ies)`;
    }

    if (/(s|x|z|ch|sh)$/i.test(word)) {
      return `(?:${escapedWord}|${escapedWord}es)`;
    }

    return `(?:${escapedWord}|${escapedWord}s)`;
  }

  private async fetchInstance(instanceName: string) {
    try {
      const response = await this.http.get('/instance/fetchInstances');
      const instances = this.normalizeInstancesPayload(response.data);

      return (
        instances.find((instance) => {
          const name =
            instance?.instance?.instanceName ||
            instance?.instanceName ||
            instance?.name;
          return name === instanceName;
        }) || null
      );
    } catch (error) {
      this.logger.error(
        'Erro ao buscar instâncias da Evolution API',
        this.describeError(error),
      );
      throw error;
    }
  }

  private async createInstance(instanceName: string) {
    const payload = {
      instanceName: instanceName,
      token: instanceName,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    };

    try {
      const response = await this.http.post('/instance/create', payload);
      return response.data;
    } catch (error) {
      if (this.isAxiosError(error)) {
        const responseData = error.response?.data as
          | { response?: { message?: string[] } }
          | undefined;
        const message = responseData?.response?.message;
        const hasInvalidIntegration =
          Array.isArray(message) &&
          message.includes('Invalid integration');

        if (hasInvalidIntegration) {
          const fallbackResponse = await this.http.post('/instance/create', {
            instanceName: instanceName,
            token: instanceName,
            qrcode: true,
          });

          return fallbackResponse.data;
        }
      }

      this.logger.error(
        'Erro ao criar instância na Evolution API',
        this.describeError(error),
      );
      throw error;
    }
  }

  private async setWebhook(instanceName: string) {
    const webhookUrl = this.getWebhookUrl();
    if (!webhookUrl) {
      return {
        configured: false,
        reason: 'BACKEND_URL não configurada',
      };
    }

    const payload = {
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false,
        webhook_by_events: false,
        base64: false,
        webhook_base64: false,
        events: ['QRCODE_UPDATED', 'CONNECTION_UPDATE', 'MESSAGES_UPSERT'],
      },
    };

    const response = await this.http.post(
      `/webhook/set/${instanceName}`,
      payload,
    );

    return {
      configured: true,
      url: webhookUrl,
      data: response.data,
    };
  }

  private getWebhookUrl() {
    if (!this.backendUrl) {
      return '';
    }

    return `${this.backendUrl.replace(/\/$/, '')}/whatsapp/webhook`;
  }

  private normalizeInstancesPayload(data: any): any[] {
    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data?.instances)) {
      return data.instances;
    }

    if (Array.isArray(data?.data)) {
      return data.data;
    }

    if (data?.instance || data?.instanceName || data?.name) {
      return [data];
    }

    return [];
  }

  private normalizeInstance(instance: any, fallbackInstanceName: string) {
    const instanceData = instance?.instance || instance || {};
    const status = this.normalizeConnectionStatus(
      instanceData.connectionStatus ||
        instanceData.status ||
        instance?.state ||
        'disconnected',
    );

    return {
      instanceName:
        instanceData.instanceName || instance?.instanceName || fallbackInstanceName,
      status,
      owner:
        instanceData.ownerJid ||
        instance?.ownerJid ||
        instanceData.profileName ||
        instance?.profileName ||
        null,
    };
  }

  private normalizeConnectionStatus(value: unknown) {
    const raw = String(value || '').trim().toLowerCase();

    if (['open', 'connected', 'online'].includes(raw)) {
      return 'open';
    }

    if (['close', 'closed', 'disconnected', 'offline'].includes(raw)) {
      return 'close';
    }

    return raw || 'disconnected';
  }

  private normalizeEvent(event: unknown) {
    if (typeof event !== 'string') {
      return 'unknown';
    }

    return event.trim().toLowerCase().replace(/_/g, '.');
  }

  private extractTextContent(message: any) {
    return (
      message?.conversation ||
      message?.extendedTextMessage?.text ||
      message?.imageMessage?.caption ||
      message?.videoMessage?.caption ||
      null
    );
  }

  private parseQuizAnswers(text: string): ParsedQuizAnswer[] {
    const parts = text
      .trim()
      .toUpperCase()
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length === 0) {
      return [];
    }

    const parsed: ParsedQuizAnswer[] = [];

    for (const part of parts) {
      const match = part.match(/^(\d+)?\s*[-.)]?\s*([A-E])$/);

      if (!match) {
        return [];
      }

      parsed.push({
        questionIndex: match[1] ? Number(match[1]) - 1 : undefined,
        selectedAnswer: match[2] as ParsedQuizAnswer['selectedAnswer'],
      });
    }

    return parsed;
  }

  private shouldProcessSelfMessage(input: {
    textContent: string | null;
    hasAudio: boolean;
  }) {
    if (!this.allowSelfWhatsappTest) {
      return false;
    }

    if (input.hasAudio) {
      return true;
    }

    if (!input.textContent) {
      return false;
    }

    return this.parseQuizAnswers(input.textContent).length > 0;
  }

  private extractOptionLetter(option: string, options: string[] = []) {
    const normalized = option?.trim();
    if (!normalized) {
      return undefined;
    }

    const directLetterMatch = normalized
      .toUpperCase()
      .match(/^([ABC])(?:\s*[-.):]?\s*.*)?$/);

    if (directLetterMatch) {
      return directLetterMatch[1] as ParsedQuizAnswer['selectedAnswer'];
    }

    const normalizedOption = this.normalizeOptionText(normalized);

    for (const candidate of options) {
      const candidateLetter = candidate
        ?.trim()
        .toUpperCase()
        .match(/^([ABC])(?:\s*[-.):]?\s*.*)?$/)?.[1];

      if (!candidateLetter) {
        continue;
      }

      if (this.normalizeOptionText(candidate) === normalizedOption) {
        return candidateLetter as ParsedQuizAnswer['selectedAnswer'];
      }
    }

    return undefined;
  }

  private normalizeOptionText(text: string) {
    return text
      .trim()
      .toUpperCase()
      .replace(/^([ABC])(?:\s*[-.):]?\s*)?/, '')
      .replace(/\s+/g, ' ');
  }

  private formatStudentLog(student: {
    full_name: string;
    whatsapp_number: string;
  }) {
    return `${student.full_name} (${student.whatsapp_number})`;
  }

  private extractIncomingMessageId(data: any) {
    return data?.key?.id || null;
  }

  private extractQuotedMessageId(payload: any) {
    const contextInfo = this.findContextInfo(payload);
    const stanzaIdFromContext = contextInfo?.stanzaId;

    if (typeof stanzaIdFromContext === 'string' && stanzaIdFromContext.length > 0) {
      return stanzaIdFromContext;
    }

    return this.findNestedStringValue(payload, ['stanzaId', 'quotedMessageId']);
  }

  private findContextInfo(value: any): any {
    if (!value || typeof value !== 'object') {
      return null;
    }

    if (value.contextInfo && typeof value.contextInfo === 'object') {
      return value.contextInfo;
    }

    for (const nestedValue of Object.values(value)) {
      const nestedContextInfo = this.findContextInfo(nestedValue);
      if (nestedContextInfo) {
        return nestedContextInfo;
      }
    }

    return null;
  }

  private findNestedStringValue(value: any, candidateKeys: string[]): string | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    for (const [key, nestedValue] of Object.entries(value)) {
      if (
        candidateKeys.includes(key) &&
        typeof nestedValue === 'string' &&
        nestedValue.length > 0
      ) {
        return nestedValue;
      }

      const nestedResult = this.findNestedStringValue(nestedValue, candidateKeys);
      if (nestedResult) {
        return nestedResult;
      }
    }

    return null;
  }

  private async resolveReferencedMessage(quotedMessageId?: string | null) {
    if (!quotedMessageId) {
      return null;
    }

    return this.prisma.whatsappMessage.findFirst({
      where: { external_message_id: quotedMessageId },
      orderBy: { created_at: 'desc' },
    });
  }

  private async resolveNewsForIncomingMessage(
    student: StudentContext,
    relatedNewsId: string | null,
  ) {
    if (relatedNewsId) {
      const relatedNews = await this.prisma.news.findUnique({
        where: { id: relatedNewsId },
      });

      if (relatedNews) {
        return relatedNews;
      }
    }

    let latestNews = await this.prisma.news.findFirst({
      where: {
        teacher_id: student.teacher_id,
        level: student.english_level ? student.english_level : undefined,
      },
      orderBy: { created_at: 'desc' },
    });

    if (!latestNews) {
      latestNews = await this.prisma.news.findFirst({
        where: { teacher_id: student.teacher_id },
        orderBy: { created_at: 'desc' },
      });
    }

    return latestNews;
  }

  private normalizeRemoteJid(numberOrGroupId: string) {
    if (numberOrGroupId.includes('@')) {
      return numberOrGroupId;
    }

    return `${numberOrGroupId}@s.whatsapp.net`;
  }

  private async getTeacherNewsGroupTitle(teacherId: string) {
    const teacher = await this.prisma.user.findUnique({
      where: { id: teacherId },
      select: { news_group_title: true },
    });

    return teacher?.news_group_title?.trim() || this.defaultNewsGroupTitle;
  }

  private async resolveGroupById(teacherId: string, groupId: string) {
    const normalizedGroupId = groupId?.trim();
    if (!normalizedGroupId) {
      return null;
    }

    const cachedGroups = await this.getCachedGroups(teacherId);
    const cachedGroup = cachedGroups.find(
      (group) => group.id === normalizedGroupId,
    );

    if (cachedGroup) {
      return cachedGroup;
    }

    return null;
  }

  private normalizeGroupList(data: any): EvolutionGroup[] {
    const groups = Array.isArray(data)
      ? data
      : Array.isArray(data?.groups)
        ? data.groups
        : Array.isArray(data?.data)
          ? data.data
          : [];

    return (groups as any[])
      .map((group: any) => ({
        id: String(group?.id || '').trim(),
        subject: String(group?.subject || group?.name || '').trim(),
        owner: group?.owner || null,
        size: typeof group?.size === 'number' ? group.size : null,
        creation: typeof group?.creation === 'number' ? group.creation : null,
        desc: typeof group?.desc === 'string' ? group.desc : null,
      }))
      .filter((group: EvolutionGroup) => group.id.endsWith('@g.us') && group.subject.length > 0)
      .sort((a: EvolutionGroup, b: EvolutionGroup) => a.subject.localeCompare(b.subject, 'pt-BR'));
  }

  private normalizeGroupTitle(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private getSyncState(teacherId: string): WhatsappSyncState {
    const existing = this.syncStateByTeacher.get(teacherId);
    if (existing) {
      return existing;
    }

    const state: WhatsappSyncState = {
      teacherId,
      stage: 'idle',
      progress: 0,
      message: 'Aguardando sincronizacao inicial.',
      inProgress: false,
      ready: false,
      stale: false,
      attempts: 0,
      groupsCount: 0,
      lastError: null,
      startedAt: null,
      completedAt: null,
      updatedAt: new Date().toISOString(),
    };
    this.syncStateByTeacher.set(teacherId, state);
    return state;
  }

  private updateSyncState(
    teacherId: string,
    partial: Partial<WhatsappSyncState>,
  ): WhatsappSyncState {
    const current = this.getSyncState(teacherId);
    const next: WhatsappSyncState = {
      ...current,
      ...partial,
      teacherId,
      updatedAt: new Date().toISOString(),
    };
    this.syncStateByTeacher.set(teacherId, next);
    return next;
  }

  private resetAllSyncStates(stage: WhatsappSyncStage = 'idle', message?: string) {
    for (const teacherId of this.syncStateByTeacher.keys()) {
      this.updateSyncState(teacherId, {
        stage,
        progress: stage === 'waiting_connection' ? 0 : 5,
        message:
          message ||
          (stage === 'waiting_connection'
            ? 'Conecte o WhatsApp para iniciar a sincronizacao.'
            : 'Aguardando sincronizacao inicial.'),
        inProgress: false,
        ready: false,
        stale: false,
        attempts: 0,
        groupsCount: 0,
        lastError: null,
        startedAt: null,
        completedAt: null,
      });
    }
  }

  private startTeacherSync(teacherId: string, force = false) {
    const current = this.getSyncState(teacherId);
    if (current.inProgress) {
      return current;
    }

    if (current.ready && !force) {
      return current;
    }

    this.updateSyncState(teacherId, {
      stage: 'warming_up',
      progress: 10,
      message: 'WhatsApp conectado. Iniciando sincronizacao dos grupos...',
      inProgress: true,
      ready: false,
      stale: false,
      attempts: 0,
      groupsCount: current.groupsCount || 0,
      lastError: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
    });

    void this.runTeacherSync(teacherId);
    return this.getSyncState(teacherId);
  }

  private async runTeacherSync(teacherId: string) {
    const delays = [5000, 7000, 10000];

    try {
      for (let attempt = 1; attempt <= delays.length; attempt += 1) {
        this.updateSyncState(teacherId, {
          stage: attempt === 1 ? 'warming_up' : 'syncing_groups',
          progress: Math.min(25 + attempt * 20, 85),
          message:
            attempt === 1
              ? 'Conexao confirmada. Preparando a leitura dos grupos...'
              : `Sincronizando grupos no WhatsApp (tentativa ${attempt}/${delays.length})...`,
          attempts: attempt,
        });

        await this.sleep(delays[attempt - 1]);

        try {
          const groups = await this.fetchGroupsFromEvolution(teacherId, 45000);
          await this.cacheGroups(teacherId, groups);
          this.markSyncAsReady(teacherId, groups.length, false, null);
          return;
        } catch (error) {
          const lastAttempt = attempt === delays.length;
          const errorMessage = this.describeError(error);

          if (!lastAttempt) {
            this.updateSyncState(teacherId, {
              stage: 'syncing_groups',
              progress: Math.min(35 + attempt * 15, 90),
              message:
                'A Evolution ainda esta sincronizando os grupos. Vamos tentar novamente.',
              lastError: errorMessage,
            });
            continue;
          }

          const cachedGroups = await this.getCachedGroups(teacherId);
          if (cachedGroups.length > 0) {
            this.markSyncAsReady(
              teacherId,
              cachedGroups.length,
              true,
              'Sincronizacao finalizada com cache local. Os grupos mais recentes podem levar alguns instantes para aparecer.',
            );
            return;
          }

          this.updateSyncState(teacherId, {
            stage: 'error',
            progress: 100,
            message:
              'Nao foi possivel concluir a sincronizacao dos grupos. Tente novamente em alguns instantes.',
            inProgress: false,
            ready: false,
            stale: false,
            lastError: errorMessage,
            completedAt: new Date().toISOString(),
          });
          return;
        }
      }
    } catch (error) {
      this.updateSyncState(teacherId, {
        stage: 'error',
        progress: 100,
        message:
          'Ocorreu um erro inesperado durante a sincronizacao do WhatsApp.',
        inProgress: false,
        ready: false,
        stale: false,
        lastError: this.describeError(error),
        completedAt: new Date().toISOString(),
      });
    }
  }

  private markSyncAsReady(
    teacherId: string,
    groupsCount: number,
    stale: boolean,
    customMessage: string | null,
  ) {
    this.updateSyncState(teacherId, {
      stage: stale ? 'degraded' : 'ready',
      progress: 100,
      message:
        customMessage ||
        `Sincronizacao concluida. ${groupsCount} grupo(s) disponivel(is).`,
      inProgress: false,
      ready: true,
      stale,
      groupsCount,
      lastError: stale ? this.getSyncState(teacherId).lastError : null,
      completedAt: new Date().toISOString(),
    });
  }

  private async fetchGroupsFromEvolution(teacherId: string, timeout = 60000): Promise<EvolutionGroup[]> {
    const instanceName = await this.resolveInstanceName(teacherId);
    const response = await this.http.get(
      `/group/fetchAllGroups/${instanceName}`,
      {
        timeout,
        params: {
          getParticipants: false,
        },
      },
    );

    return this.normalizeGroupList(response.data);
  }

  private async cacheGroups(teacherId: string, groups: EvolutionGroup[]) {
    for (const group of groups) {
      try {
        await this.prisma.whatsappGroup.upsert({
          where: {
            group_identifier: group.id,
          },
          update: {
            teacher_id: teacherId,
            group_name: group.subject,
          },
          create: {
            teacher_id: teacherId,
            group_name: group.subject,
            group_identifier: group.id,
          },
        });
      } catch (error) {
        this.logger.warn(
          `[GROUPS][CACHE] Nao foi possivel sincronizar o grupo ${group.subject} (${group.id}) no banco: ${this.describeError(error)}`,
        );
      }
    }
  }

  private async getCachedGroups(teacherId: string): Promise<EvolutionGroup[]> {
    const groups = await this.prisma.whatsappGroup.findMany({
      where: { teacher_id: teacherId },
      orderBy: { group_name: 'asc' },
    });

    return groups.map((group) => ({
      id: group.group_identifier,
      subject: group.group_name,
      owner: null,
      size: null,
      creation: null,
      desc: null,
    }));
  }

  private extractQrCode(payload: any) {
    const rawQrCode =
      payload?.base64 ||
      payload?.qrcode?.base64 ||
      payload?.code ||
      payload?.qrcode?.code ||
      null;

    if (typeof rawQrCode !== 'string' || rawQrCode.length === 0) {
      return null;
    }

    return rawQrCode.startsWith('data:image')
      ? rawQrCode
      : `data:image/png;base64,${rawQrCode}`;
  }

  private getCachedQrCode(instanceName: string) {
    const cached = this.qrCodeCache.get(instanceName);

    if (!cached) {
      return null;
    }

    if (Date.now() - cached.timestamp > this.qrCodeTtlMs) {
      this.qrCodeCache.delete(instanceName);
      return null;
    }

    return cached.base64;
  }

  private setCachedQrCode(instanceName: string, base64: string) {
    this.qrCodeCache.set(instanceName, {
      base64,
      timestamp: Date.now(),
    });
  }

  private isAxiosError(error: unknown): error is AxiosError {
    return axios.isAxiosError(error);
  }

  private isRequestTimeout(error: unknown) {
    return (
      this.isAxiosError(error) &&
      (error.code === 'ECONNABORTED' ||
        String(error.message || '').toLowerCase().includes('timeout'))
    );
  }

  private describeError(error: unknown) {
    if (this.isAxiosError(error)) {
      const responseData = error.response?.data;
      if (typeof responseData === 'string') {
        return responseData;
      }

      if (responseData && typeof responseData === 'object') {
        try {
          return JSON.stringify(responseData);
        } catch {
          return error.message;
        }
      }

      return error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
