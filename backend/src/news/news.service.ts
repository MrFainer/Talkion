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
  private readonly stopMarkers = [
    'You can watch the original video',
    'LEARN 3000 WORDS with NEWS IN LEVELS',
    'How to improve your English with News in Levels',
    'Test Languages',
    'Stock images by',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly quizService: QuizService,
    private readonly creditsService: CreditsService,
  ) {}

  async cleanupNewsAudio(newsId: string) {
    try {
      const news = await this.prisma.news.findUnique({ where: { id: newsId }, select: { audio_url: true } });
      if (!news?.audio_url) return;

      const filePath = join(process.cwd(), news.audio_url.replace(/^\//, ''));
      await unlink(filePath).catch(() => {});
      await this.prisma.news.update({
        where: { id: newsId },
        data: { audio_url: null },
      });
      this.logger.log(`Áudio deletado: ${newsId}`);
    } catch (error) {
      this.logger.warn(`Erro ao deletar áudio ${newsId}: ${error instanceof Error ? error.message : String(error)}`);
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
      const mp3Files = files.filter(f => f.endsWith('.mp3'));
      if (mp3Files.length === 0) return;

      const ids = mp3Files.map(f => parse(f).name);
      const existing = await this.prisma.news.findMany({
        where: { id: { in: ids } },
        select: { id: true },
      });
      const existingSet = new Set(existing.map(n => n.id));

      for (const file of mp3Files) {
        const id = parse(file).name;
        if (!existingSet.has(id)) {
          const filePath = join(audioDir, file);
          await unlink(filePath).catch(() => {});
          this.logger.log(`Áudio órfão deletado: ${file}`);
        }
      }
    } catch (error) {
      this.logger.warn(`Erro ao limpar áudios órfãos: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async cleanupAllNewsAudio() {
    try {
      await this.prisma.news.updateMany({
        where: { audio_url: { not: null } },
        data: { audio_url: null },
      });
      this.logger.log('audio_url limpos de todas as notícias');

      const audioDir = join(process.cwd(), 'uploads', 'news-audio');
      let files: string[];
      try {
        files = await readdir(audioDir);
      } catch {
        return;
      }
      const mp3Files = files.filter(f => f.endsWith('.mp3'));
      for (const file of mp3Files) {
        const filePath = join(audioDir, file);
        await unlink(filePath).catch(() => {});
      }
      if (mp3Files.length > 0) {
        this.logger.log(`${mp3Files.length} arquivos de áudio removidos`);
      }
    } catch (error) {
      this.logger.warn(`Erro ao limpar todos os áudios: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async handleDailyNewsScraping() {
    this.logger.log('Iniciando captura diária de notícias e quizzes para todos os professores...');
    const activeTeachers = await this.prisma.user.findMany({
      where: { role: 'TEACHER', active: true },
      select: { id: true },
    });

    if (activeTeachers.length === 0) {
      this.logger.log('Nenhum professor ativo encontrado. Cron de notícias não executado.');
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
        this.logger.error(`Erro ao gerar notícia para o professor ${teacher.id}:`, error);
      }
    }
  }

  async runDailyNewsAndQuiz(tracking?: UsageTrackingContext, generateQuiz: boolean = true) {
    const teacherId = tracking?.teacherId;
    if (!teacherId) {
      throw new BadRequestException('teacherId é obrigatório para gerar notícia e quiz.');
    }

    const teacher = await this.prisma.user.findUnique({
      where: { id: teacherId },
      select: { role: true, active: true },
    });

    if (!teacher || !teacher.active || teacher.role !== 'TEACHER') {
      throw new BadRequestException('Apenas professores ativos podem gerar notícia e quiz.');
    }

    const newsResults = await this.scrapeLatestNews(tracking);
    const quizResults = generateQuiz
      ? await this.generateQuizzesForResults(newsResults, tracking)
      : [];

    return {
      message: 'Processamento diário de notícias e quiz concluído.',
      news: {
        created: newsResults.filter((item) => item.status === 'created').length,
        skippedSameDay: newsResults.filter((item) => item.status === 'skipped_same_day').length,
        skippedSameNews: newsResults.filter((item) => item.status === 'skipped_same_news').length,
        errors: newsResults.filter((item) => item.status === 'error').length,
        items: newsResults,
      },
      quizzes: {
        created: quizResults.filter((item) => item.status === 'created').length,
        existing: quizResults.filter((item) => item.status === 'existing').length,
        errors: quizResults.filter((item) => item.status === 'error').length,
        items: quizResults,
      },
    };
  }

  async scrapeLatestNews(tracking?: UsageTrackingContext): Promise<NewsProcessingResult[]> {
    return this.scrapeLatestNewsFromSite(tracking);
  }

  private async scrapeLatestNewsFromSite(
    tracking?: UsageTrackingContext,
  ): Promise<NewsProcessingResult[]> {
    const results: NewsProcessingResult[] = [];

    await this.cleanupAllNewsAudio();

    try {
      const response = await axios.get(this.baseUrl);
      const data: string = response.data as string;
      const $ = cheerio.load(data);

      const firstNewsLink = $('.news-block a').first().attr('href');
      if (!firstNewsLink) {
        throw new Error('Nenhuma notícia encontrada na página inicial.');
      }

      this.logger.log(`Última notícia encontrada: ${firstNewsLink}`);

      results.push(
        await this.extractNewsDetails(firstNewsLink, 'LEVEL_1', tracking),
        await this.extractNewsDetails(firstNewsLink, 'LEVEL_2', tracking),
        await this.extractNewsDetails(firstNewsLink, 'LEVEL_3', tracking),
      );

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
        'Erro ao buscar notícias do NewsInLevels, acionando fallback IA...',
        error,
      );
      results.push(...(await this.generateFallbackNewsForAllLevels(tracking)));
      return results;
    }

    // Fall back to AI for any individual level that failed, keeping successful ones
    if (results.some((item) => item.status === 'error')) {
      this.logger.warn(
        'Alguns níveis falharam no scraping. Gerando fallback via IA para complementar...',
      );
      const fallbackResults = await this.generateFallbackNewsForAllLevels(tracking, {
        referenceType: 'news_scrape_error_fallback',
        referenceId: new Date().toISOString().slice(0, 10),
      });

      for (let i = 0; i < results.length; i++) {
        if (results[i].status === 'error') {
          const fallbackItem = fallbackResults.find((fr) => fr.level === results[i].level);
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
            options?.referenceType || tracking?.referenceType || 'news_fallback',
          referenceId:
            options?.referenceId || tracking?.referenceId || 'bundle',
          metadata: {
            ...(tracking?.metadata || {}),
            trigger: options?.referenceType === 'news_duplicate_fallback' ? 'duplicate_fallback' : 'fallback',
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
          this.logger.log(`Notícia Fallback salva via IA: [${level}] ${item.title}`);
        }
      }
    } catch (err) {
      this.logger.error('Falha ao gerar notícia fallback via IA (bundle)', err);
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

  private async extractNewsDetails(
    baseLink: string,
    level: string,
    tracking?: UsageTrackingContext,
  ): Promise<NewsProcessingResult> {
    try {
      // Exemplo de link: https://www.newsinlevels.com/products/london-bridge-is-falling-down-level-1/
      // Ajusta o link para o nível correto
      const levelNumber = level.split('_')[1];
      let url = baseLink;
      if (!url.includes(`level-${levelNumber}`)) {
        // Tenta corrigir a URL para o nível desejado caso o link base seja de outro nível
        url = url.replace(/level-\d/, `level-${levelNumber}`);
      }

      const response = await axios.get<string>(url);
      const data = response.data;
      const $ = cheerio.load(data);

      const title = this.extractTitle($, url);
      const content = this.extractContent(data, $, title);
      const audioUrl = this.extractAudioUrl($);

      if (!title || !content) {
        this.logger.warn(
          `Não foi possível extrair conteúdo completo de: ${url}`,
        );
        return {
          level,
          status: 'error',
          reason: 'Não foi possível extrair conteúdo completo.',
        };
      }

      if (audioUrl) {
        this.logger.log(`Áudio encontrado para [${level}]: ${audioUrl}`);
      }

      const result = await this.saveNewsIfAllowed({
        title,
        content,
        level,
        sourceType: SourceType.SCRAPED,
        sourceUrl: url,
        audioUrl: audioUrl || undefined,
      }, tracking);

      if (result.status === 'created') {
        this.logger.log(`Nova notícia salva: [${level}] ${title}`);
      }
      return {
        ...result,
        incomingTitle: title,
        incomingContent: content,
        incomingSourceUrl: url,
        incomingAudioUrl: audioUrl || undefined,
      };
    } catch (error) {
      this.logger.error(
        `Erro ao extrair nível ${level}`,
        error instanceof Error ? error.message : String(error),
      );
      return {
        level,
        status: 'error',
        reason:
          error instanceof Error ? error.message : 'Erro ao extrair notícia.',
      };
    }
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
        const quizResult = await this.quizService.generateQuizForNews(item.newsId, {
          ...tracking,
          newsId: item.newsId,
          referenceType: tracking?.referenceType || 'daily_news_quiz',
          referenceId: tracking?.referenceId || item.newsId,
        });

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

  private async saveNewsIfAllowed(input: {
    title: string;
    content: string;
    level: string;
    sourceType: SourceType;
    sourceUrl?: string;
    audioUrl?: string;
  }, tracking?: UsageTrackingContext): Promise<NewsProcessingResult> {
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
      (await this.hasEquivalentLatestNews(input.level, input.title, input.content, input.sourceUrl, tracking))
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
      const actionKey = input.sourceType === SourceType.AI_GENERATED
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
      const actionKey = input.sourceType === SourceType.AI_GENERATED
        ? 'news_ai_fallback'
        : `news_capture_${input.level.toLowerCase().replace('level_', 'level_')}`;
      await this.creditsService.deductCredits(tracking.teacherId, actionKey, 'news', createdNews.id);
    }

    if (input.sourceType === SourceType.AI_GENERATED) {
      try {
        if (tracking?.teacherId) {
          await this.creditsService.requireCredits(tracking.teacherId, 'news_tts');
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
        this.logger.log(`Áudio gerado para notícia IA: [${input.level}] ${input.title}`);

        if (tracking?.teacherId) {
          await this.creditsService.deductCredits(tracking.teacherId, 'news_tts', 'news', createdNews.id);
        }
      } catch (error) {
        this.logger.warn(
          `Falha ao gerar áudio para notícia [${input.level}] ${input.title}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (input.sourceType === SourceType.SCRAPED && input.audioUrl) {
      try {
        this.logger.log(`Baixando áudio SoundCloud (MP3) para [${input.level}]: ${input.audioUrl}`);
        const audioDir = join(process.cwd(), 'uploads', 'news-audio');
        await mkdir(audioDir, { recursive: true });
        const ext = '.mp3';
        const filePath = join(audioDir, `${createdNews.id}${ext}`);

        const stream = await scdl.downloadFormat(input.audioUrl, 'audio/mpeg');
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
        this.logger.log(`Áudio SoundCloud MP3 baixado para notícia: [${input.level}] ${input.title}`);
      } catch (error) {
        this.logger.warn(
          `Falha ao baixar áudio SoundCloud para [${input.level}] ${input.title}: ${error instanceof Error ? error.message : String(error)}`,
        );
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

  private getTodayRange() {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    return { startOfDay, endOfDay };
  }

  private extractTitle(
    $: ReturnType<typeof cheerio.load>,
    url: string,
  ): string {
    const titleFromUrl = this.extractTitleFromUrl(url);

    if (titleFromUrl) {
      return titleFromUrl;
    }

    const selectors = [
      'h1.entry-title',
      'article h1',
      'main h1',
      '.entry-title',
      '.post-title',
      'h1',
      'meta[property="og:title"]',
      'meta[name="twitter:title"]',
      'title',
    ];

    for (const selector of selectors) {
      const element = $(selector).first();
      const value = element.attr('content')?.trim() || element.text().trim();
      if (value) {
        const normalizedTitle = this.normalizeTitle(value);
        if (normalizedTitle) {
          return normalizedTitle;
        }
      }
    }

    return '';
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

    if (normalizedExistingUrl && normalizedExistingUrl === normalizedIncomingUrl) {
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
    return (value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  private extractAudioUrl($: ReturnType<typeof cheerio.load>): string | null {
    const iframe = $('iframe[src*="soundcloud.com"]').first();
    const src = iframe.attr('src');
    if (src) {
      const match = src.match(/url=([^&]+)/);
      if (match) {
        try {
          const decodedUrl = decodeURIComponent(match[1]);
          const finalUrl = decodeURIComponent(decodedUrl);
          return finalUrl;
        } catch {
          const fallbackLink = $('a[href*="soundcloud.com/newsinlevels/"]').first().attr('href');
          return fallbackLink || null;
        }
      }
    }
    const directLink = $('a[href*="soundcloud.com/newsinlevels/"]').first().attr('href');
    return directLink || null;
  }

  private extractContent(
    html: string,
    $: ReturnType<typeof cheerio.load>,
    title: string,
  ): string {
    this.sanitizeDocument($);

    // Abordagem radical: Pegar TUDO que for texto do corpo da página
    // e extrair o miolo exato entre o Título/Data e "Difficult words:"
    // Pega todo o texto visível da tag <body>
    const rawBodyText = $('body').text();
    // Troca múltiplos espaços/quebras por um espaço simples
    const flatText = rawBodyText.replace(/\s+/g, ' ');

    // Precisamos achar o início. Geralmente é a data (ex: 08-05-2026 15:00) ou o título
    const dateRegex = /\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}/;
    const dateMatch = flatText.match(dateRegex);
    let startIndex = 0;
    if (dateMatch && dateMatch.index !== undefined) {
      // Começa logo DEPOIS da data
      startIndex = dateMatch.index + dateMatch[0].length;
    } else {
      // Se não achou data, tenta achar o título exato
      const titleIndex = flatText.indexOf(title);
      if (titleIndex !== -1) {
        startIndex = titleIndex + title.length;
      }
    }

    // Corta o texto do início para frente
    const contentSection = flatText.substring(startIndex).trim();

    // Agora achamos o fim, que é onde começam as propagandas/botões pós-notícia
    const difficultWordsIdx = contentSection.indexOf('Difficult words:');
    let cutEndIndex = contentSection.length;

    if (difficultWordsIdx !== -1) {
      // Pega as difficult words inteiras. O texto geralmente termina no primeiro ponto final ou vírgula
      // após a palavra "ship)" ou "clean)" etc. Vamos procurar a próxima palavra que sinaliza propaganda.
      const stopPhrases = [
        'You can watch the video news lower on this page.',
        'You can watch the original video',
        'LEARN 3000 WORDS with NEWS IN LEVELS',
        'News in Levels is designed',
        'Test Languages',
        'Stock images',
        'News in Levels ·',
      ];
      for (const phrase of stopPhrases) {
        const idx = contentSection.indexOf(phrase, difficultWordsIdx);
        if (idx !== -1 && idx < cutEndIndex) {
          cutEndIndex = idx;
        }
      }
    } else {
      // Se não tem difficult words, corta na primeira propaganda que achar
      for (const marker of this.stopMarkers) {
        const idx = contentSection.indexOf(marker);
        if (idx !== -1 && idx < cutEndIndex) {
          cutEndIndex = idx;
        }
      }
    }

    // Agora temos a string bruta EXATA da notícia.
    let rawContent = contentSection.substring(0, cutEndIndex).trim();

    // Remove eventuais botões "Level 1 Level 2 Level 3" que ficaram perdidos no meio
    rawContent = rawContent.replace(/Level\s[123]/gi, '').trim();

    // LOG: Imprime o texto final de forma mais limpa
    this.logger.log(`

[${title}]
${rawContent}

`);

    // Retorna a string inteira formatada (bruta com a quebra de linha nas difficult words)
    return this.formatRawText(rawContent, title);
  }

  // Pega a string colada e tenta devolver os parágrafos
  private formatRawText(text: string, title: string): string {
    const content = text.replace(/Toggle navigation/gi, title);
    // Separamos a parte da notícia das "Difficult words" para não quebrar a legenda
    const diffIdx = content.indexOf('Difficult words:');
    let newsPart = content;
    let diffPart = '';
    if (diffIdx !== -1) {
      newsPart = content.substring(0, diffIdx);
      diffPart = content.substring(diffIdx);
    }

    // Retorna a string bruta como foi capturada.
    // Só junta a notícia com as difficult words usando uma DUPLA quebra de linha.
    if (diffPart) {
      return `${newsPart.trim()}\n\n${diffPart.trim()}`;
    }

    return newsPart.trim();
  }

  private extractContentFromHtml(html: string, title: string): string {
    const cleanedHtml = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h1|h2|h3|h4|li|article|section|main|ul|ol)>/gi, '\n');

    const parsedHtml = cheerio.load(cleanedHtml);
    const text = parsedHtml.root().text();
    const lines = text
      .split('\n')
      .map((line: string) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    if (lines.length === 0) {
      return '';
    }

    const dateIndex = lines.findIndex((line: string) =>
      /^\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}$/.test(line),
    );
    const matchingTitleIndexes = lines
      .map((line: string, index: number) => ({
        index,
        matches: this.normalizeTitle(line) === title || line.includes(title),
      }))
      .filter((entry: { index: number; matches: boolean }) => entry.matches)
      .map((entry: { index: number; matches: boolean }) => entry.index);

    let startIndex = 0;

    if (matchingTitleIndexes.length > 0) {
      const titleBeforeDate = matchingTitleIndexes.filter(
        (index: number) => dateIndex === -1 || index <= dateIndex,
      );
      const titleIndex =
        titleBeforeDate.length > 0
          ? titleBeforeDate[titleBeforeDate.length - 1]
          : matchingTitleIndexes[matchingTitleIndexes.length - 1];

      startIndex = titleIndex + 1;
    } else if (dateIndex >= 0) {
      startIndex = dateIndex + 1;
    }

    const validParagraphs: string[] = [];

    for (const line of lines.slice(startIndex)) {
      if (this.stopMarkers.some((marker) => line.includes(marker))) {
        break;
      }

      if (this.normalizeTitle(line) === title || line === title) {
        continue;
      }

      if (this.looksLikeJavaScript(line) || this.looksLikeNoise(line)) {
        continue;
      }

      if (
        /^Level\s[123]$/i.test(line) ||
        /^\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}$/.test(line)
      ) {
        continue;
      }

      validParagraphs.push(line);

      if (line.includes('Difficult words:')) {
        break;
      }
    }

    return validParagraphs.join('\n\n');
  }

  private fallbackExtractFromParagraphs(
    $: ReturnType<typeof cheerio.load>,
    title: string,
  ): string {
    const paragraphs = $('p')
      .map((_, el) => $(el).text().replace(/\s+/g, ' ').trim())
      .get()
      .filter(Boolean);

    const validParagraphs: string[] = [];

    for (const p of paragraphs) {
      if (
        this.stopMarkers.some((marker: string) =>
          (p as string).includes(marker),
        )
      )
        break;
      if (this.looksLikeJavaScript(p as string)) continue;
      if (
        /^Level\s[123]$/i.test(p as string) ||
        /^\d{2}-\d{2}-\d{4}/.test(p as string)
      )
        continue;

      validParagraphs.push(p as string);

      if (typeof p === 'string' && p.includes('Difficult words:')) {
        break;
      }
    }

    this.logCapturedTexts(`fallback-p:${title}`, validParagraphs);

    return this.cleanExtractedContent(validParagraphs.join('\n\n'), title);
  }

  private extractContentFromBodyLines(
    $: ReturnType<typeof cheerio.load>,
    title: string,
  ): string {
    const rawBodyLines = $('body')
      .text()
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    if (rawBodyLines.length === 0) {
      return '';
    }

    const titleIndex = rawBodyLines.findIndex((line) => {
      const normalizedLine = this.normalizeTitle(line);
      return normalizedLine === title || line === title;
    });

    const dateIndex = rawBodyLines.findIndex((line) =>
      /^\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}$/.test(line),
    );
    const startIndex =
      dateIndex >= 0 ? dateIndex + 1 : titleIndex >= 0 ? titleIndex + 1 : 0;

    const candidateLines = rawBodyLines
      .slice(startIndex)
      .filter((line) => this.isValidContentLine(line));

    return this.trimContentAtMarkers(candidateLines).join('\n\n');
  }

  private trimContentAtMarkers(lines: string[]): string[] {
    const trimmed: string[] = [];
    let insideDifficultWords = false;

    for (const line of lines) {
      if (this.stopMarkers.some((marker) => line.includes(marker))) {
        break;
      }

      trimmed.push(line);

      if (line.includes('Difficult words:')) {
        insideDifficultWords = true;
      }

      if (insideDifficultWords && /[.!?]$/.test(line.trim())) {
        break;
      }
    }

    return trimmed.filter((line) => !this.looksLikeNoise(line));
  }

  private sanitizeDocument($: ReturnType<typeof cheerio.load>) {
    $('script, style, noscript, iframe, svg').remove();
  }

  private cleanExtractedContent(content: string, title: string): string {
    return content
      .replace(/Toggle navigation/gi, title)
      .replace(/Difficult words:/g, '\n\nDifficult words:')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private logCapturedTexts(context: string, texts: string[]) {
    // Essa função foi mantida caso precisemos debugar algo no futuro,
    // mas removida do fluxo principal para manter o terminal limpo.
  }

  private pickBestContentCandidate(candidates: string[][]): string[] {
    if (candidates.length === 0) {
      return [];
    }

    return candidates.sort((a, b) => {
      const scoreA = this.scoreContentCandidate(a);
      const scoreB = this.scoreContentCandidate(b);
      return scoreB - scoreA;
    })[0];
  }

  private scoreContentCandidate(blocks: string[]): number {
    const joined = blocks.join(' ');
    return blocks.length * 1000 + joined.length;
  }

  private isValidContentLine(line: string): boolean {
    if (!line) {
      return false;
    }

    if (/^Level\s[123]$/i.test(line)) {
      return false;
    }

    if (/^\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}$/.test(line)) {
      return false;
    }

    return true;
  }

  private looksLikeNoise(line: string): boolean {
    return (
      line.length < 15 ||
      /^A virus on a ship – level \d$/i.test(line) ||
      /^News in Levels$/i.test(line) ||
      /^World News for Students of English$/i.test(line) ||
      /^Which .+\?$/.test(line) ||
      this.looksLikeJavaScript(line)
    );
  }

  private looksLikeJavaScript(line: string): boolean {
    const javascriptPatterns = [
      /\bfunction\s*\(/i,
      /\bfunction\s+[A-Za-z_$][\w$]*\s*\(/,
      /\bvar\s+[A-Za-z_$][\w$]*/i,
      /\blet\s+[A-Za-z_$][\w$]*/i,
      /\bconst\s+[A-Za-z_$][\w$]*/i,
      /=>/,
      /\bdocument\./i,
      /\bwindow\./i,
      /\bconsole\./i,
      /\baddEventListener\b/i,
      /\bsetTimeout\b/i,
      /\bsetInterval\b/i,
      /[A-Za-z_$][\w$]*\s*=\s*function\b/,
      /[{;].*[=}]/,
    ];

    return javascriptPatterns.some((pattern) => pattern.test(line));
  }
}
