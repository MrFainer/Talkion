import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { PrismaService } from '../prisma.service';
import { AiService } from '../ai/ai.service';

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
  ) {}

  // Executa todos os dias às 06:00 da manhã
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async handleDailyNewsScraping() {
    this.logger.log('Iniciando captura diária de notícias...');
    await this.scrapeLatestNews();
  }

  async scrapeLatestNews() {
    try {
      const response = await axios.get(this.baseUrl);
      const data: string = response.data as string;
      const $ = cheerio.load(data);

      const firstNewsLink = $('.news-block a').first().attr('href');
      if (!firstNewsLink) {
        throw new Error('Nenhuma notícia encontrada na página inicial.');
      }

      this.logger.log(`Última notícia encontrada: ${firstNewsLink}`);

      await this.extractNewsDetails(firstNewsLink, 'LEVEL_1');
      await this.extractNewsDetails(firstNewsLink, 'LEVEL_2');
      await this.extractNewsDetails(firstNewsLink, 'LEVEL_3');
    } catch (error) {
      this.logger.error(
        'Erro ao buscar notícias do NewsInLevels, acionando fallback IA...',
        error,
      );
      await this.generateFallbackNewsForAllLevels();
    }
  }

  private async generateFallbackNewsForAllLevels() {
    const levels = ['LEVEL_1', 'LEVEL_2', 'LEVEL_3'];
    for (const level of levels) {
      try {
        const { title, content } =
          await this.aiService.generateFallbackNews(level);
        await this.prisma.news.create({
          data: {
            title,
            content,
            level,
            source_type: 'AI_GENERATED',
          },
        });
        this.logger.log(`Notícia Fallback salva via IA: [${level}] ${title}`);
      } catch (err) {
        this.logger.error(`Falha ao gerar notícia fallback para ${level}`, err);
      }
    }
  }

  private async extractNewsDetails(baseLink: string, level: string) {
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

      if (!title || !content) {
        this.logger.warn(
          `Não foi possível extrair conteúdo completo de: ${url}`,
        );
        return;
      }

      // Verifica se já existem registros para o mesmo nível/url e sincroniza todos
      const existingNews = await this.prisma.news.findMany({
        where: {
          OR: [
            { source_url: url, level },
            { title, level },
          ],
        },
      });

      if (existingNews.length === 0) {
        await this.prisma.news.create({
          data: {
            title,
            content,
            level,
            source_type: 'SCRAPED',
            source_url: url,
          },
        });
        this.logger.log(`Notícia salva: [${level}] ${title}`);
      } else {
        const existingIds = existingNews.map((news) => news.id);
        const updateResult = await this.prisma.news.updateMany({
          where: { id: { in: existingIds } },
          data: {
            title,
            content,
            level,
            source_type: 'SCRAPED',
            source_url: url,
          },
        });
        this.logger.log(
          `Notícia atualizada: [${level}] ${title} | registros: ${updateResult.count} | ids: ${existingIds.join(', ')}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Erro ao extrair nível ${level}`,
        error instanceof Error ? error.message : String(error),
      );
    }
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
