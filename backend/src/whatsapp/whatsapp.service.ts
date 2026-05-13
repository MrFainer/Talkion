import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { PrismaService } from '../prisma.service';
import { AiService } from '../ai/ai.service';
import { QuizService } from '../quiz/quiz.service';
import { NewsService } from '../news/news.service';

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
  full_name: string;
  whatsapp_number: string;
  english_level?: string;
};

type OutboundMessageTracking = {
  studentId?: string | null;
  remoteJid?: string | null;
  relatedNewsId?: string | null;
  relatedQuizId?: string | null;
  contentKind?: string | null;
  quotedMessageId?: string | null;
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
  private readonly instanceName =
    process.env.EVOLUTION_INSTANCE_NAME || 'talkion_main';
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly quizService: QuizService,
    private readonly newsService: NewsService,
  ) {}

  /**
   * Garante que a instância principal exista na Evolution API.
   */
  async getOrCreateInstance() {
    const existingInstance = await this.fetchInstance();

    if (existingInstance) {
      return this.normalizeInstance(existingInstance);
    }

    await this.createInstance();

    if (this.getWebhookUrl()) {
      await this.setWebhook();
    }

    const createdInstance = await this.fetchInstance();
    return this.normalizeInstance(createdInstance);
  }

  /**
   * Retorna o estado atual da instância e tenta garantir que ela exista.
   */
  async getStatus() {
    const instance = await this.getOrCreateInstance();
    return {
      ...instance,
      webhookUrl: this.getWebhookUrl(),
    };
  }

  /**
   * Tenta obter o QR Code de conexão da instância.
   */
  async getQrCode() {
    const cached = this.getCachedQrCode();
    if (cached) {
      return {
        status: 'QRCODE_AVAILABLE',
        qrcode: {
          base64: cached,
          cached: true,
        },
      };
    }

    const instance = await this.getOrCreateInstance();

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
      const response = await this.http.get(
        `/instance/connect/${this.instanceName}`,
      );
      const qrCode =
        this.extractQrCode(response.data) || this.getCachedQrCode();

      if (qrCode) {
        this.setCachedQrCode(qrCode);
        return {
          status: 'QRCODE_AVAILABLE',
          qrcode: {
            base64: qrCode,
            cached: false,
            attempt,
          },
        };
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
  async registerWebhook() {
    return this.setWebhook();
  }

  /**
   * Remove a instância da Evolution API.
   */
  async logout() {
    await this.http.delete(`/instance/delete/${this.instanceName}`);
    this.qrCodeCache.delete(this.instanceName);

    return { success: true };
  }

  /**
   * Envia uma mensagem de texto (Notícia, Quiz, etc) para um grupo ou pessoa.
   */
  async sendMessage(
    numberOrGroupId: string,
    text: string,
    tracking?: OutboundMessageTracking,
  ) {
    try {
      const response = await this.http.post(`/message/sendText/${this.instanceName}`, {
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

  async sendLatestNewsAndQuiz(
    targetNumber: string,
    options?: { forceTargetType?: 'PRIVATE' | 'GROUP' },
  ) {
    const student = await this.prisma.student.findUnique({
      where: { whatsapp_number: targetNumber },
    });
    const isGroupTarget =
      options?.forceTargetType === 'GROUP' ||
      (options?.forceTargetType !== 'PRIVATE' && targetNumber.includes('@g.us'));

    const latestNews = await this.findLatestNewsForTarget(student);

    if (!latestNews) {
      throw new Error('Nenhuma notícia disponível para envio.');
    }

    let quizId: string | null = null;
    let previousQuizId: string | null = null;

    if (isGroupTarget) {
      const quiz = await this.quizService.generateQuizForNews(latestNews.id);
      const previousQuiz = await this.findPreviousQuizForAnswerKey(latestNews.id);
      const answerKeyMessage = this.formatAnswerKeyForWhatsapp(previousQuiz);
      const newsIntroMessage = this.formatTodayNewsIntroForWhatsapp();
      const newsMessage = this.formatNewsBodyForWhatsapp(
        latestNews.title,
        latestNews.content,
      );
      const quizHeaderMessage = this.formatQuizHeaderForWhatsapp();
      const quizMessage = this.formatQuizBodyForWhatsapp(
        quiz.questions as QuizQuestion[],
      );

      quizId = quiz.id;
      previousQuizId = previousQuiz?.id || null;

      await this.sendMessage(targetNumber, this.formatGroupGreetingForWhatsapp(), {
        studentId: student?.id || null,
        relatedNewsId: latestNews.id,
        relatedQuizId: quiz.id,
        contentKind: 'GROUP_GREETING',
      });

      if (answerKeyMessage) {
        await this.sendMessage(targetNumber, answerKeyMessage, {
          studentId: student?.id || null,
          relatedNewsId: previousQuiz?.news_id || null,
          relatedQuizId: previousQuiz?.id || null,
          contentKind: 'ANSWER_KEY',
        });
      }

      await this.sendMessage(targetNumber, newsIntroMessage, {
        studentId: student?.id || null,
        relatedNewsId: latestNews.id,
        contentKind: 'NEWS_INTRO',
      });
      await this.sendMessage(targetNumber, newsMessage, {
        studentId: student?.id || null,
        relatedNewsId: latestNews.id,
        contentKind: 'NEWS',
      });
      await this.sendMessage(targetNumber, quizHeaderMessage, {
        studentId: student?.id || null,
        relatedNewsId: latestNews.id,
        relatedQuizId: quiz.id,
        contentKind: 'QUIZ_HEADER',
      });
      await this.sendMessage(targetNumber, quizMessage, {
        studentId: student?.id || null,
        relatedNewsId: latestNews.id,
        relatedQuizId: quiz.id,
        contentKind: 'QUIZ',
      });
    } else {
      await this.sendMessage(targetNumber, this.formatPrivateGreetingForWhatsapp(), {
        studentId: student?.id || null,
        relatedNewsId: latestNews.id,
        contentKind: 'PRIVATE_GREETING',
      });
      await this.sendMessage(targetNumber, this.formatPrivateSpeakingIntroForWhatsapp(), {
        studentId: student?.id || null,
        relatedNewsId: latestNews.id,
        contentKind: 'SPEAKING_INTRO',
      });
      await this.sendMessage(targetNumber, this.formatTodayNewsIntroForWhatsapp(), {
        studentId: student?.id || null,
        relatedNewsId: latestNews.id,
        contentKind: 'NEWS_INTRO',
      });
      await this.sendMessage(
        targetNumber,
        this.formatNewsBodyForWhatsapp(latestNews.title, latestNews.content),
        {
          studentId: student?.id || null,
          relatedNewsId: latestNews.id,
          contentKind: 'NEWS',
        },
      );
    }

    return {
      sent: true,
      targetNumber,
      newsId: latestNews.id,
      quizId,
      previousQuizId,
      level: latestNews.level,
      targetType: isGroupTarget ? 'GROUP' : 'PRIVATE',
      forcedTargetType: options?.forceTargetType || null,
    };
  }

  /**
   * Processa os webhooks recebidos da Evolution API.
   */
  async handleWebhook(payload: any) {
    const event = this.normalizeEvent(payload?.event);

    if (event === 'qrcode.updated') {
      const qrCode = this.extractQrCode(payload);
      if (qrCode) {
        this.setCachedQrCode(qrCode);
      }

      return { processed: true, event };
    }

    if (event === 'connection.update') {
      const connectionStatus =
        payload?.data?.state || payload?.data?.status || 'unknown';

      if (connectionStatus === 'open') {
        this.qrCodeCache.delete(this.instanceName);
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
      await this.handleAudioMessage(student, remoteJid, data, quotedMessageId);
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
    student: StudentContext,
    remoteJid: string,
    messageData: any,
    quotedMessageId?: string | null,
  ) {
    try {
      const mediaResponse = await this.http.post(
        `/chat/getBase64FromMediaMessage/${this.instanceName}`,
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
        await this.sendMessage(
          remoteJid,
          'Nenhuma noticia encontrada para avaliar o audio.',
        );
        return;
      }

      const feedback = await this.aiService.evaluateSpeaking(
        latestNews.content,
        base64Audio,
        messageData?.audioMessage?.mimetype,
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
      await this.sendMessage(remoteJid, replyText, {
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

  private formatPrivateGreetingForWhatsapp() {
    return this.getMorningGreeting('☀️🌴🎉');
  }

  private formatGroupGreetingForWhatsapp() {
    return this.getMorningGreeting('🎉🎉');
  }

  private formatPrivateSpeakingIntroForWhatsapp() {
    return [
      '*Welcome to the challenge of the day 👊🏻🚀*',
      '',
      'Can you read this news out loud and send an audio here?',
      '',
      'Você pode ler esta notícia em voz alta e enviar um áudio aqui?',
      '',
      '*Have a wonderful day and let’s speak English with Talkion 😉👍🏻🗣️🇺🇸🇬🇧*',
    ].join('\n');
  }

  private formatTodayNewsIntroForWhatsapp() {
    return [
      '📰 *Let’s go to today’s news!*',
      '',
      '📰 *Vamos para a notícia do dia!*',
    ].join('\n');
  }

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

  private formatQuizHeaderForWhatsapp() {
    return [
      '📝 *Quiz do Dia*',
      '',
      '🇺🇸 Let’s check your understanding of the news.',
      '',
      'Hora de testar sua compreensão da notícia.',
      'Responda com atenção e envie tudo em uma única mensagem. 🚀',
    ].join('\n');
  }

  private formatQuizBodyForWhatsapp(questions: QuizQuestion[]) {
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
      '📩 Responda enviando `A`, `B`, `C` ou no formato `1A`, `2B`, `3C`.',
      '',
      '🍀 Boa sorte!',
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

  private async findLatestNewsForTarget(student: StudentContext | null) {
    let latestNews = await this.prisma.news.findFirst({
      where: student ? { level: student.english_level } : undefined,
      orderBy: { created_at: 'desc' },
    });

    if (!latestNews) {
      latestNews = await this.prisma.news.findFirst({
        orderBy: { created_at: 'desc' },
      });
    }

    if (!latestNews) {
      await this.newsService.scrapeLatestNews();
      latestNews = await this.prisma.news.findFirst({
        where: student ? { level: student.english_level } : undefined,
        orderBy: { created_at: 'desc' },
      });
    }

    if (!latestNews) {
      latestNews = await this.prisma.news.findFirst({
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

  private async fetchInstance() {
    try {
      const response = await this.http.get('/instance/fetchInstances');
      const instances = this.normalizeInstancesPayload(response.data);

      return (
        instances.find((instance) => {
          const name =
            instance?.instance?.instanceName ||
            instance?.instanceName ||
            instance?.name;
          return name === this.instanceName;
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

  private async createInstance() {
    const payload = {
      instanceName: this.instanceName,
      token: this.instanceName,
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
            instanceName: this.instanceName,
            token: this.instanceName,
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

  private async setWebhook() {
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
      `/webhook/set/${this.instanceName}`,
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

  private normalizeInstance(instance: any) {
    const instanceData = instance?.instance || instance || {};
    const status =
      instanceData.connectionStatus ||
      instanceData.status ||
      instance?.state ||
      'disconnected';

    return {
      instanceName:
        instanceData.instanceName || instance.instanceName || this.instanceName,
      status,
      owner:
        instanceData.ownerJid || instance.ownerJid || instanceData.profileName,
    };
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
      const match = part.match(/^(\d+)?\s*[-.)]?\s*([ABC])$/);

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
      where: student.english_level ? { level: student.english_level } : undefined,
      orderBy: { created_at: 'desc' },
    });

    if (!latestNews) {
      latestNews = await this.prisma.news.findFirst({
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

  private getCachedQrCode() {
    const cached = this.qrCodeCache.get(this.instanceName);

    if (!cached) {
      return null;
    }

    if (Date.now() - cached.timestamp > this.qrCodeTtlMs) {
      this.qrCodeCache.delete(this.instanceName);
      return null;
    }

    return cached.base64;
  }

  private setCachedQrCode(base64: string) {
    this.qrCodeCache.set(this.instanceName, {
      base64,
      timestamp: Date.now(),
    });
  }

  private isAxiosError(error: unknown): error is AxiosError {
    return axios.isAxiosError(error);
  }

  private describeError(error: unknown) {
    if (this.isAxiosError(error)) {
      return error.response?.data || error.message;
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
