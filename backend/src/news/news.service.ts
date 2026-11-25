import { Injectable, Logger, BadRequestException } from '@nestjs/common';

import axios from 'axios';
import * as cheerio from 'cheerio';
import { SourceType } from '@prisma/client';
import { mkdir, writeFile, unlink, readdir } from 'node:fs/promises';
import { join, parse } from 'node:path';
import { PrismaService } from '../prisma.service';
import { AiService } from '../ai/ai.service';
import { CreditsService } from '../credits/credits.service';
import type { UsageTrackingContext } from '../ai/usage-cost.service';
import { QuizService } from '../quiz/quiz.service';
import { assertServiceAllowed } from '../subscriptions/subscription-access';

const { default: scdl } = require('soundcloud-downloader');

type NewsProcessingStatus =
  | 'created'
  | 'skipped_same_day'
  | 'skipped_same_news'
  | 'error';

type NewsProcessingResult = {
  level: string;
  status: NewsProcessingStatus;
  title?: string;
  newsId?: string;
  reason?: string;
  incomingTitle?: string;
  incomingContent?: string;
  incomingSourceUrl?: string;
  incomingAudioUrl?: string;
};

type QuizProcessingResult = {
  level: string;
  newsId?: string;
  quizId?: string;
  status: 'created' | 'existing' | 'skipped' | 'error';
  reason?: string;
};

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);
  private readonly baseUrl = 'https://www.newsinlevels.com';
  private readonly newsInLevelsHeaders = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Sec-Fetch-Dest': 'document',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0',
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly quizService: QuizService,
    private readonly creditsService: CreditsService,
  ) {}

  private formatErrorForLog(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const method = error.config?.method?.toUpperCase() || 'GET';
      const url = error.config?.url || '';
      return `AxiosError: ${error.message}${
        status ? ` (status ${status})` : ''
      } [${method} ${url}]`;
    }
    if (error instanceof Error) {
      return `${error.name}: ${error.message}`;
    }
    return String(error);
  }

  async cleanupNewsAudio(newsId: string) {
    try {
      const news = await this.prisma.news.findUnique({
        where: { id: newsId },
        select: { audio_url: true },
      });
      if (!news?.audio_url) return;

      const filePath = join(process.cwd(), news.audio_url.replace(/^\//, ''));
      await unlink(filePath).catch(() => {});
      await this.prisma.news.update({
        where: { id: newsId },
        data: { audio_url: null },
      });
      this.logger.log(`Áudio deletado: ${newsId}`);
    } catch (error) {
      this.logger.warn(
        `Erro ao deletar áudio ${newsId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async cleanupOrphanedAudioFiles() {
    try {
      const audioDir = join(process.cwd(), 'uploads', 'news-audio');
      let files: string[];
      try {
        files = await readdir(audioDir);
      } catch {
        return;
      }
      const mp3Files = files.filter((f) => f.endsWith('.mp3'));
      if (mp3Files.length === 0) return;

      const ids = mp3Files.map((f) => parse(f).name);
      const existing = await this.prisma.news.findMany({
        where: { id: { in: ids } },
        select: { id: true },
      });
      const existingSet = new Set(existing.map((n) => n.id));

      for (const file of mp3Files) {
        const id = parse(file).name;
        if (!existingSet.has(id)) {
          const filePath = join(audioDir, file);
          await unlink(filePath).catch(() => {});
          this.logger.log(`Áudio órfão deletado: ${file}`);
        }
      }
    } catch (error) {
      this.logger.warn(
        `Erro ao limpar áudios órfãos: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async cleanupAllNewsAudio(teacherId?: string) {
    try {
      const where: any = { audio_url: { not: null } };
      if (teacherId) {
        where.teacher_id = teacherId;
      }
      await this.prisma.news.updateMany({
        where,
        data: { audio_url: null },
      });
      const scope = teacherId
        ? `do professor ${teacherId}`
        : 'de todas as notícias';
      this.logger.log(`audio_url limpos ${scope}`);

      if (teacherId) {
        const teacherNews = await this.prisma.news.findMany({
          where: { teacher_id: teacherId },
          select: { id: true },
        });
        const teacherIds = new Set(teacherNews.map((n) => n.id));
        const audioDir = join(process.cwd(), 'uploads', 'news-audio');
        let files: string[];
        try {
          files = await readdir(audioDir);
        } catch {
          return;
        }
        const toDelete = files.filter(
          (f) => f.endsWith('.mp3') && teacherIds.has(parse(f).name),
        );
        for (const file of toDelete) {
          const filePath = join(audioDir, file);
          await unlink(filePath).catch(() => {});
        }
        if (toDelete.length > 0) {
          this.logger.log(
            `${toDelete.length} arquivos de áudio do professor ${teacherId} removidos`,
          );
        }
      } else {
        const audioDir = join(process.cwd(), 'uploads', 'news-audio');
        let files: string[];
        try {
          files = await readdir(audioDir);
        } catch {
          return;
        }
        const mp3Files = files.filter((f) => f.endsWith('.mp3'));
        for (const file of mp3Files) {
          const filePath = join(audioDir, file);
          await unlink(filePath).catch(() => {});
        }
        if (mp3Files.length > 0) {
          this.logger.log(`${mp3Files.length} arquivos de áudio removidos`);
        }
      }
    } catch (error) {
      this.logger.warn(
        `Erro ao limpar áudios${teacherId ? ` do professor ${teacherId}` : ''}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async handleDailyNewsScraping() {
    this.logger.log(
      'Iniciando captura diária de notícias e quizzes para todos os professores...',
    );
    const activeTeachers = await this.prisma.user.findMany({
      where: { role: 'TEACHER', active: true },
      select: { id: true },
    });

    if (activeTeachers.length === 0) {
      this.logger.log(
        'Nenhum professor ativo encontrado. Cron de notícias não executado.',
      );
      return;
    }

    for (const teacher of activeTeachers) {
      try {
        await this.runDailyNewsAndQuiz({
          teacherId: teacher.id,
          referenceType: 'daily_news_job',
          referenceId: new Date().toISOString().slice(0, 10),
          metadata: {
            trigger: 'cron',
          },
        });
      } catch (error) {
        this.logger.error(
          `Erro ao gerar notícia para o professor ${teacher.id}: ${this.formatErrorForLog(error)}`,
        );
      }
    }
  }

  async runDailyNewsAndQuiz(
    tracking?: UsageTrackingContext,
    generateQuiz: boolean = true,
  ) {
    const teacherId = tracking?.teacherId;
    if (!teacherId) {
      throw new BadRequestException(
        'teacherId é obrigatório para gerar notícia e quiz.',
      );
    }

    await assertServiceAllowed(this.prisma, teacherId);

    const teacher = await this.prisma.user.findUnique({
      where: { id: teacherId },
      select: { role: true, active: true },
    });

    if (!teacher || !teacher.active || teacher.role !== 'TEACHER') {
      throw new BadRequestException(
        'Apenas professores ativos podem gerar notícia e quiz.',
      );
    }

    const studentCount = await this.prisma.student.count({
      where: { teacher_id: teacherId, active: true },
    });

    const messageSettings = await this.prisma.messageSettings.findUnique({
      where: { teacher_id: teacherId },
      select: {
        auto_group_targets: true,
        group_send_enabled: true,
        admin_group_send_enabled: true,
      },
    });

    const groupSendEnabled =
      messageSettings?.group_send_enabled !== false &&
      messageSettings?.admin_group_send_enabled !== false;
    const groupTargets = Array.isArray(messageSettings?.auto_group_targets)
      ? messageSettings.auto_group_targets.filter((target: any) =>
          Boolean(String(target?.groupId || target?.id || '').trim()),
        )
      : [];

    if (
      studentCount === 0 &&
      (!groupSendEnabled || groupTargets.length === 0)
    ) {
      this.logger.log(
        `Professor ${teacherId} não possui alunos ativos nem grupos configurados para envio. Pulando captura de notícia e geração de quiz para não debitar créditos desnecessariamente.`,
      );
      return {
        message:
          'Professor sem alunos ativos e sem grupos configurados. Captura de notícia e quiz ignorados.',
        news: {
          created: 0,
          skippedSameDay: 0,
          skippedSameNews: 0,
          errors: 0,
          items: [],
        },
        quizzes: { created: 0, existing: 0, errors: 0, items: [] },
      };
    }

    const newsResults = await this.scrapeLatestNews(tracking);
    const quizResults = generateQuiz
      ? await this.generateQuizzesForResults(newsResults, tracking)
      : [];

    return {
      message: 'Processamento diário de notícias e quiz concluído.',
      news: {
        created: newsResults.filter((item) => item.status === 'created').length,
        skippedSameDay: newsResults.filter(
          (item) => item.status === 'skipped_same_day',
        ).length,
        skippedSameNews: newsResults.filter(
          (item) => item.status === 'skipped_same_news',
        ).length,
        errors: newsResults.filter((item) => item.status === 'error').length,
        items: newsResults,
      },
      quizzes: {
        created: quizResults.filter((item) => item.status === 'created').length,
        existing: quizResults.filter((item) => item.status === 'existing')
          .length,
        errors: quizResults.filter((item) => item.status === 'error').length,
        items: quizResults,
      },
    };
  }

  async scrapeLatestNews(
    tracking?: UsageTrackingContext,
  ): Promise<NewsProcessingResult[]> {
    return this.scrapeLatestNewsFromSite(tracking);
  }

  private async fetchNewsInLevelsHtml(
    url: string,
    attempts = 3,
  ): Promise<string> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const response = await axios.get<string>(url, {
          headers: this.newsInLevelsHeaders,
          timeout: 20000,
        });
        return response.data;
      } catch (error) {
        lastError = error;
        const status = axios.isAxiosError(error)
          ? error.response?.status
          : undefined;
        if (attempt === attempts) {
          this.logger.warn(
            `Falha ao buscar ${url} após ${attempts} tentativas${
              status ? ` (status ${status})` : ''
            }.`,
          );
        }
        if (attempt < attempts) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
        }
      }
    }

    throw lastError;
  }

  private async fetchLatestNewsLevelsFromFeed(): Promise<
    {
      level: string;
      title: string;
      content: string;
      sourceUrl: string;
    }[]
  > {
    const xml = await this.fetchNewsInLevelsHtml(`${this.baseUrl}/feed/`);
    const $ = cheerio.load(xml, { xmlMode: true });

    const items: { title: string; link: string; encoded: string }[] = [];
    $('item').each((_, element) => {
      const link = $(element).find('link').first().text().trim();
      const encoded = $(element)
        .find('content\\:encoded')
        .first()
        .text()
        .trim();
      if (!link || !encoded) return;
      items.push({
        title: $(element).find('title').first().text().trim(),
        link,
        encoded,
      });
    });

    if (items.length === 0) {
      return [];
    }

    const slugOf = (link: string) =>
      link.replace(/-level-[123]\/?$/i, '').replace(/\/+$/, '');

    // O feed vem ordenado do mais recente e os 3 níveis do mesmo artigo
    // compartilham o mesmo slug.
    const latestSlug = slugOf(items[0].link);
    const latestItems = items.filter(
      (item) => slugOf(item.link) === latestSlug,
    );

    const byLevel = new Map<
      string,
      { level: string; title: string; content: string; sourceUrl: string }
    >();

    for (const item of latestItems) {
      const levelMatch = item.link.match(/level-([123])/i);
      if (!levelMatch) continue;

      const level = `LEVEL_${levelMatch[1]}`;
      if (byLevel.has(level)) continue;

      const title =
        this.extractTitleFromUrl(item.link) || this.normalizeTitle(item.title);
      const content = this.extractFeedContent(item.encoded, title);
      if (!title || !content) continue;

      byLevel.set(level, { level, title, content, sourceUrl: item.link });
    }

    return ['LEVEL_1', 'LEVEL_2', 'LEVEL_3']
      .map((level) => byLevel.get(level))
      .filter(
        (
          item,
        ): item is {
          level: string;
          title: string;
          content: string;
          sourceUrl: string;
        } => Boolean(item),
      );
  }

  private extractFeedContent(encodedHtml: string, title: string): string {
    const $ = cheerio.load(encodedHtml);
    const paragraphs: string[] = [];
    $('p').each((_, element) => {
      const text = $(element).text().replace(/\s+/g, ' ').trim();
      if (text) {
        paragraphs.push(text);
      }
    });

    const lines: string[] = [];
    for (const paragraph of paragraphs) {
      // Linha de data, botões de nível e rodapé do WordPress não fazem parte do texto.
      if (/^\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}$/.test(paragraph)) continue;
      if (/^Level\s[123]$/i.test(paragraph)) continue;
      if (/appeared first on/i.test(paragraph)) continue;

      lines.push(paragraph);
      if (paragraph.includes('Difficult words:')) break;
    }

    return this.cleanExtractedContent(lines.join('\n\n'), title);
  }

  private async scrapeLatestNewsFromSite(
    tracking?: UsageTrackingContext,
  ): Promise<NewsProcessingResult[]> {
    const results: NewsProcessingResult[] = [];

    const alreadyHasAllLevels = await this.checkExistingNewsForToday(tracking);
    if (alreadyHasAllLevels) {
      this.logger.log(
        `Notícias do dia já existem para teacherId=${tracking?.teacherId}. Pulando scraping e limpeza de áudio.`,
      );
      return alreadyHasAllLevels;
    }

    await this.cleanupAllNewsAudio(tracking?.teacherId ?? undefined);

    try {
      // O HTML do site é bloqueado por reputação de IP (403) no servidor.
      // O RSS feed (/feed/) está liberado e traz o texto completo dos 3 níveis.
      const feedLevels = await this.fetchLatestNewsLevelsFromFeed();

      if (feedLevels.length === 0) {
        throw new Error('Nenhuma notícia encontrada no RSS feed.');
      }

      this.logger.log(
        `Última notícia encontrada via RSS feed: ${feedLevels[0]?.sourceUrl}`,
      );

      const feedByLevel = new Map(feedLevels.map((item) => [item.level, item]));

      for (const level of ['LEVEL_1', 'LEVEL_2', 'LEVEL_3'] as const) {
        const item = feedByLevel.get(level);
        if (!item) {
          this.logger.warn(`Nível ${level} não encontrado no RSS feed.`);
          results.push({
            level,
            status: 'error',
            reason: 'Nível não encontrado no RSS feed.',
          });
          continue;
        }

        const result = await this.saveNewsIfAllowed(
          {
            title: item.title,
            content: item.content,
            level: item.level,
            sourceType: SourceType.SCRAPED,
            sourceUrl: item.sourceUrl,
          },
          tracking,
        );

        if (result.status === 'created') {
          this.logger.log(
            `Nova notícia salva via RSS: [${item.level}] ${item.title}`,
          );
        }

        results.push({
          ...result,
          incomingTitle: item.title,
          incomingContent: item.content,
          incomingSourceUrl: item.sourceUrl,
        });
      }

      const allSameNews =
        results.length === 3 &&
        results.every((item) => item.status === 'skipped_same_news');
      if (allSameNews) {
        this.logger.warn(
          'NewsInLevels parece não ter atualizado a notícia (mesma do banco). Gerando alternativa via IA para LEVEL_1/2/3.',
        );
        return this.generateFallbackNewsForAllLevels(tracking, {
          referenceType: 'news_duplicate_fallback',
          referenceId: new Date().toISOString().slice(0, 10),
          avoidByLevel: {
            LEVEL_1: {
              avoidTitle: results[0]?.incomingTitle,
              avoidContent: results[0]?.incomingContent,
            },
            LEVEL_2: {
              avoidTitle: results[1]?.incomingTitle,
              avoidContent: results[1]?.incomingContent,
            },
            LEVEL_3: {
              avoidTitle: results[2]?.incomingTitle,
              avoidContent: results[2]?.incomingContent,
            },
          },
        });
      }
    } catch (error) {
      this.logger.error(
        `Erro ao buscar notícias do NewsInLevels, acionando fallback IA... ${this.formatErrorForLog(error)}`,
      );
      results.push(...(await this.generateFallbackNewsForAllLevels(tracking)));
      return results;
    }

    // Fall back to AI for any individual level that failed, keeping successful ones
    if (results.some((item) => item.status === 'error')) {
      this.logger.warn(
        'Alguns níveis falharam no scraping. Gerando fallback via IA para complementar...',
      );
      const fallbackResults = await this.generateFallbackNewsForAllLevels(
        tracking,
        {
          referenceType: 'news_scrape_error_fallback',
          referenceId: new Date().toISOString().slice(0, 10),
        },
      );

      for (let i = 0; i < results.length; i++) {
        if (results[i].status === 'error') {
          const fallbackItem = fallbackResults.find(
            (fr) => fr.level === results[i].level,
          );
          if (fallbackItem) {
            results[i] = fallbackItem;
          }
        }
      }
    }

    return results;
  }

  private async generateFallbackNewsForAllLevels(
    tracking?: UsageTrackingContext,
    options?: {
      referenceType?: string;
      referenceId?: string;
      avoidByLevel?: Partial<
        Record<
          'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3',
          { avoidTitle?: string; avoidContent?: string }
        >
      >;
    },
  ): Promise<NewsProcessingResult[]> {
    const levels = ['LEVEL_1', 'LEVEL_2', 'LEVEL_3'] as const;
    const results: NewsProcessingResult[] = [];
    try {
      const bundle = await this.aiService.generateFallbackNewsBundle(
        {
          ...tracking,
          referenceType:
            options?.referenceType ||
            tracking?.referenceType ||
            'news_fallback',
          referenceId:
            options?.referenceId || tracking?.referenceId || 'bundle',
          metadata: {
            ...(tracking?.metadata || {}),
            trigger:
              options?.referenceType === 'news_duplicate_fallback'
                ? 'duplicate_fallback'
                : 'fallback',
          },
        },
        options?.avoidByLevel,
      );

      for (const level of levels) {
        const item = bundle[level];
        const result = await this.saveNewsIfAllowed(
          {
            title: item.title,
            content: item.content,
            level,
            sourceType: SourceType.AI_GENERATED,
          },
          tracking,
        );
        results.push(result);
        if (result.status === 'created') {
          this.logger.log(
            `Notícia Fallback salva via IA: [${level}] ${item.title}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `Falha ao gerar notícia fallback via IA (bundle): ${this.formatErrorForLog(err)}`,
      );
      for (const level of levels) {
        results.push({
          level,
          status: 'error',
          reason: 'Falha ao gerar notícia fallback via IA.',
        });
      }
    }

    return results;
  }

  private async generateQuizzesForResults(
    newsResults: NewsProcessingResult[],
    tracking?: UsageTrackingContext,
  ): Promise<QuizProcessingResult[]> {
    const quizResults: QuizProcessingResult[] = [];

    for (const item of newsResults) {
      if (!item.newsId) {
        quizResults.push({
          level: item.level,
          status: item.status === 'error' ? 'error' : 'skipped',
          reason: item.reason || 'Nenhuma notícia elegível para gerar quiz.',
        });
        continue;
      }

      try {
        const quizResult = await this.quizService.generateQuizForNews(
          item.newsId,
          {
            ...tracking,
            newsId: item.newsId,
            referenceType: tracking?.referenceType || 'daily_news_quiz',
            referenceId: tracking?.referenceId || item.newsId,
          },
        );

        quizResults.push({
          level: item.level,
          newsId: item.newsId,
          quizId: quizResult.quiz.id,
          status: quizResult.created ? 'created' : 'existing',
        });
      } catch (error) {
        quizResults.push({
          level: item.level,
          newsId: item.newsId,
          status: 'error',
          reason:
            error instanceof Error ? error.message : 'Erro ao gerar quiz.',
        });
      }
    }

    return quizResults;
  }

  private async generateTtsFallbackAudio(
    news: { id: string },
    input: { level: string; title: string; content: string },
    tracking?: UsageTrackingContext,
  ): Promise<void> {
    try {
      if (tracking?.teacherId) {
        await this.creditsService.requireCredits(
          tracking.teacherId,
          'news_tts_fallback',
        );
      }
      const audioBuffer = await this.aiService.generateNewsAudio(
        input.content,
        {
          ...tracking,
          newsId: news.id,
        },
      );
      const audioDir = join(process.cwd(), 'uploads', 'news-audio');
      await mkdir(audioDir, { recursive: true });
      const filePath = join(audioDir, `${news.id}.mp3`);
      await writeFile(filePath, audioBuffer);
      const audioUrlPath = `/uploads/news-audio/${news.id}.mp3`;
      await this.prisma.news.update({
        where: { id: news.id },
        data: { audio_url: audioUrlPath },
      });
      this.logger.log(`Áudio TTS gerado para: [${input.level}] ${input.title}`);

      if (tracking?.teacherId) {
        await this.creditsService.deductCredits(
          tracking.teacherId,
          'news_tts_fallback',
          'news',
          news.id,
        );
      }
    } catch (ttsError) {
      this.logger.warn(
        `Falha ao gerar áudio TTS para [${input.level}] ${input.title}: ${ttsError instanceof Error ? ttsError.message : String(ttsError)}`,
      );
    }
  }

  private async saveNewsIfAllowed(
    input: {
      title: string;
      content: string;
      level: string;
      sourceType: SourceType;
      sourceUrl?: string;
      audioUrl?: string;
    },
    tracking?: UsageTrackingContext,
  ): Promise<NewsProcessingResult> {
    const { startOfDay, endOfDay } = this.getTodayRange();

    const existingToday = await this.prisma.news.findFirst({
      where: {
        level: input.level,
        teacher_id: tracking?.teacherId || null,
        created_at: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: { created_at: 'desc' },
    });

    if (existingToday) {
      this.logger.log(
        `Notícia do dia já existente ignorada: [${input.level}] ${input.title} | id existente: ${existingToday.id}`,
      );
      return {
        level: input.level,
        status: 'skipped_same_day',
        title: existingToday.title,
        newsId: existingToday.id,
        reason: 'Já existe uma notícia cadastrada para este nível hoje.',
      };
    }

    const existingSameNews = await this.prisma.news.findFirst({
      where: {
        level: input.level,
        teacher_id: tracking?.teacherId || null,
        OR: [
          ...(input.sourceUrl ? [{ source_url: input.sourceUrl }] : []),
          { title: input.title },
        ],
      },
      orderBy: { created_at: 'desc' },
    });

    if (
      existingSameNews ||
      (await this.hasEquivalentLatestNews(
        input.level,
        input.title,
        input.content,
        input.sourceUrl,
        tracking,
      ))
    ) {
      const matchedNews =
        existingSameNews ||
        (await this.prisma.news.findFirst({
          where: {
            level: input.level,
            teacher_id: tracking?.teacherId || null,
          },
          orderBy: { created_at: 'desc' },
        }));

      if (matchedNews) {
        this.logger.log(
          `Notícia repetida ignorada: [${input.level}] ${input.title} | mesma notícia já existe no banco (${matchedNews.id}).`,
        );
        return {
          level: input.level,
          status: 'skipped_same_news',
          title: matchedNews.title,
          newsId: matchedNews.id,
          reason: 'Essa notícia já existe na base.',
        };
      }
    }

    if (tracking?.teacherId) {
      const actionKey =
        input.sourceType === SourceType.AI_GENERATED
          ? 'news_ai_fallback'
          : `news_capture_${input.level.toLowerCase().replace('level_', 'level_')}`;
      await this.creditsService.requireCredits(tracking.teacherId, actionKey);
    }

    const createdNews = await this.prisma.news.create({
      data: {
        teacher_id: tracking?.teacherId || null,
        title: input.title,
        content: input.content,
        level: input.level,
        source_type: input.sourceType,
        source_url: input.sourceUrl,
      },
    });

    if (tracking?.teacherId) {
      const actionKey =
        input.sourceType === SourceType.AI_GENERATED
          ? 'news_ai_fallback'
          : `news_capture_${input.level.toLowerCase().replace('level_', 'level_')}`;
      await this.creditsService.deductCredits(
        tracking.teacherId,
        actionKey,
        'news',
        createdNews.id,
      );
    }

    if (input.sourceType === SourceType.AI_GENERATED) {
      try {
        if (tracking?.teacherId) {
          await this.creditsService.requireCredits(
            tracking.teacherId,
            'news_tts',
          );
        }
        const audioBuffer = await this.aiService.generateNewsAudio(
          input.content,
          { ...tracking, newsId: createdNews.id },
        );
        const audioDir = join(process.cwd(), 'uploads', 'news-audio');
        await mkdir(audioDir, { recursive: true });
        const filePath = join(audioDir, `${createdNews.id}.mp3`);
        await writeFile(filePath, audioBuffer);
        const audioUrl = `/uploads/news-audio/${createdNews.id}.mp3`;
        await this.prisma.news.update({
          where: { id: createdNews.id },
          data: { audio_url: audioUrl },
        });
        this.logger.log(
          `Áudio gerado para notícia IA: [${input.level}] ${input.title}`,
        );

        if (tracking?.teacherId) {
          await this.creditsService.deductCredits(
            tracking.teacherId,
            'news_tts',
            'news',
            createdNews.id,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Falha ao gerar áudio para notícia [${input.level}] ${input.title}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (input.sourceType === SourceType.SCRAPED) {
      if (input.audioUrl) {
        try {
          this.logger.log(
            `Baixando áudio SoundCloud (MP3) para [${input.level}]: ${input.audioUrl}`,
          );
          const audioDir = join(process.cwd(), 'uploads', 'news-audio');
          await mkdir(audioDir, { recursive: true });
          const ext = '.mp3';
          const filePath = join(audioDir, `${createdNews.id}${ext}`);

          const stream = await scdl.downloadFormat(
            input.audioUrl,
            'audio/mpeg',
          );
          const chunks: Buffer[] = [];
          for await (const chunk of stream) {
            chunks.push(Buffer.from(chunk));
          }
          const audioBuffer = Buffer.concat(chunks);
          await writeFile(filePath, audioBuffer);

          const audioUrlPath = `/uploads/news-audio/${createdNews.id}${ext}`;
          await this.prisma.news.update({
            where: { id: createdNews.id },
            data: { audio_url: audioUrlPath },
          });
          this.logger.log(
            `Áudio SoundCloud MP3 baixado para notícia: [${input.level}] ${input.title}`,
          );
        } catch (error) {
          this.logger.warn(
            `Falha ao baixar áudio SoundCloud para [${input.level}] ${input.title}: ${error instanceof Error ? error.message : String(error)}. Gerando via TTS...`,
          );
          await this.generateTtsFallbackAudio(createdNews, input, tracking);
        }
      } else {
        // Notícia capturada via RSS não traz link do SoundCloud: gera o áudio com TTS.
        await this.generateTtsFallbackAudio(createdNews, input, tracking);
      }
    }

    return {
      level: input.level,
      status: 'created',
      title: createdNews.title,
      newsId: createdNews.id,
    };
  }

  private async hasEquivalentLatestNews(
    level: string,
    title: string,
    content: string,
    sourceUrl?: string,
    tracking?: UsageTrackingContext,
  ) {
    const latestSavedNews = await this.prisma.news.findFirst({
      where: {
        level,
        teacher_id: tracking?.teacherId || null,
      },
      orderBy: { created_at: 'desc' },
    });

    if (!latestSavedNews) {
      return false;
    }

    return this.isSameNews(latestSavedNews, {
      title,
      content,
      source_url: sourceUrl || '',
    });
  }

  private async checkExistingNewsForToday(
    tracking?: UsageTrackingContext,
  ): Promise<NewsProcessingResult[] | null> {
    const { startOfDay, endOfDay } = this.getTodayRange();
    const existing = await this.prisma.news.findMany({
      where: {
        teacher_id: tracking?.teacherId || null,
        level: { in: ['LEVEL_1', 'LEVEL_2', 'LEVEL_3'] as const },
        created_at: { gte: startOfDay, lte: endOfDay },
      },
      orderBy: { created_at: 'desc' },
      select: { id: true, title: true, level: true, audio_url: true },
    });

    const byLevel = new Map<string, (typeof existing)[number]>();
    for (const item of existing) {
      if (!byLevel.has(item.level)) {
        byLevel.set(item.level, item);
      }
    }

    if (byLevel.size < 3) return null;

    const allHaveAudio = Array.from(byLevel.values()).every((n) => n.audio_url);
    if (!allHaveAudio) {
      this.logger.log(
        `[NEWS] 3 níveis existem mas nem todos têm áudio para teacherId=${tracking?.teacherId}. Permitindo regeneração.`,
      );
      return null;
    }

    this.logger.log(
      `[NEWS] 3 níveis com áudio já existem hoje para teacherId=${tracking?.teacherId}. Pulando regeneração.`,
    );
    return Array.from(byLevel.values()).map((n) => ({
      level: n.level,
      status: 'skipped_same_day' as const,
      title: n.title,
      newsId: n.id,
      reason: 'Já existe uma notícia cadastrada para este nível hoje.',
    }));
  }

  private getTodayRange() {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    return { startOfDay, endOfDay };
  }

  private extractTitleFromUrl(url: string): string {
    const match = url.match(/\/products\/(.+)-level-([123])\/?$/i);

    if (!match) {
      return '';
    }

    const [, slug, levelNumber] = match;
    const baseTitle = slug
      .split('-')
      .filter(Boolean)
      .map((part, index) => {
        if (
          index > 0 &&
          [
            'a',
            'an',
            'and',
            'as',
            'at',
            'for',
            'from',
            'in',
            'of',
            'on',
            'or',
            'the',
            'to',
            'with',
          ].includes(part)
        ) {
          return part;
        }

        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(' ');

    return `${baseTitle} – level ${levelNumber}`;
  }

  private normalizeTitle(rawTitle: string): string {
    const cleanedTitle = rawTitle.replace(/\s+/g, ' ').trim();
    const match = cleanedTitle.match(/(.+?\s[–-]\slevel\s[123])/i);

    if (match) {
      return match[1].trim();
    }

    return cleanedTitle;
  }

  private isSameNews(
    existingNews: {
      title: string;
      content: string;
      source_url: string | null;
    },
    incomingNews: {
      title: string;
      content: string;
      source_url: string;
    },
  ): boolean {
    const normalizedExistingUrl = this.normalizeComparableValue(
      existingNews.source_url,
    );
    const normalizedIncomingUrl = this.normalizeComparableValue(
      incomingNews.source_url,
    );

    if (
      normalizedExistingUrl &&
      normalizedExistingUrl === normalizedIncomingUrl
    ) {
      return true;
    }

    const normalizedExistingTitle = this.normalizeComparableValue(
      existingNews.title,
    );
    const normalizedIncomingTitle = this.normalizeComparableValue(
      incomingNews.title,
    );

    if (
      normalizedExistingTitle &&
      normalizedExistingTitle === normalizedIncomingTitle
    ) {
      return true;
    }

    const normalizedExistingContent = this.normalizeComparableValue(
      existingNews.content,
    );
    const normalizedIncomingContent = this.normalizeComparableValue(
      incomingNews.content,
    );

    return (
      normalizedExistingContent.length > 0 &&
      normalizedExistingContent === normalizedIncomingContent
    );
  }

  private normalizeComparableValue(value: string | null | undefined): string {
    return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private cleanExtractedContent(content: string, title: string): string {
    return content
      .replace(/Toggle navigation/gi, title)
      .replace(/Difficult words:/g, '\n\nDifficult words:')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
