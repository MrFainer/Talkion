import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { AiService } from '../ai/ai.service';

type TrendItem = {
  title: string;
  area: string;
};

const CACHE_TTL = 60 * 60 * 1000;
const cacheMap = new Map<string, { data: TrendItem[]; timestamp: number }>();

const AREA_KEYWORDS: Record<string, string[]> = {
  education: [
    'educação',
    'escola',
    'curso',
    'enem',
    'estudar',
    'aprender',
    'professor',
    'aluno',
    'prova',
    'vestibular',
    'faculdade',
    'idioma',
    'inglês',
    'aula',
    'learning',
  ],
  business: [
    'economia',
    'mercado',
    'emprego',
    'salário',
    'inflação',
    'empresa',
    'negócios',
    'investimento',
    'financeiro',
    'pib',
    'dólar',
    'trabalho',
    'carteira',
  ],
  technology: [
    'tecnologia',
    'app',
    'internet',
    'ia',
    'software',
    'celular',
    'digital',
    'rede social',
    'chip',
    'processador',
    'nintendo',
    'playstation',
    'pc',
    'notebook',
    'iphone',
  ],
  health: [
    'saúde',
    'doença',
    'vacina',
    'exercício',
    'alimentação',
    'médico',
    'hospital',
    'dieta',
    'covid',
    'bem-estar',
    'mental',
    'sono',
  ],
  entertainment: [
    'filme',
    'série',
    'show',
    'famoso',
    'música',
    'futebol',
    'tv',
    'artista',
    'esporte',
    'novela',
    'bbb',
    'the town',
    'rock in rio',
    'olimpíadas',
    'netflix',
  ],
};

const GEO_LABELS: Record<string, string> = {
  BR: 'Brasil',
  US: 'EUA',
  GB: 'Reino Unido',
  PT: 'Portugal',
  AR: 'Argentina',
  MX: 'México',
};

const FALLBACK_TRENDS: TrendItem[] = [
  { title: 'Produtos de limpeza', area: 'business' },
  { title: 'Inflação no Brasil', area: 'business' },
  { title: 'Copa do Mundo', area: 'entertainment' },
  { title: 'Inteligência Artificial', area: 'technology' },
  { title: 'Shows e eventos', area: 'entertainment' },
  { title: 'Enem 2026', area: 'education' },
  { title: 'Mudanças climáticas', area: 'education' },
  { title: 'Novo celular lançamento', area: 'technology' },
  { title: 'Receitas saudáveis', area: 'health' },
  { title: 'Séries do momento', area: 'entertainment' },
];

@Injectable()
export class TrendsService {
  private readonly logger = new Logger(TrendsService.name);

  constructor(private readonly aiService: AiService) {}

  async getTrending(area?: string, geo?: string): Promise<TrendItem[]> {
    const region = geo || 'BR';
    const cacheKey = `trends_${region}`;

    const cached = cacheMap.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return this.filterByArea(cached.data, area);
    }

    try {
      const response = await fetch(
        `https://trends.google.com/trending/rss?geo=${region}`,
        {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TalkionBot/1.0)' },
          signal: AbortSignal.timeout(10000),
        },
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const xml = await response.text();
      const $ = cheerio.load(xml, { xmlMode: true });
      const seen = new Set<string>();
      const items: TrendItem[] = [];

      $('item title').each((_, el) => {
        const title = $(el).text().trim();
        if (title && !seen.has(title.toLowerCase())) {
          seen.add(title.toLowerCase());
          items.push({ title, area: this.classifyArea(title) });
        }
      });

      if (items.length === 0) throw new Error('No items found in RSS');

      cacheMap.set(cacheKey, { data: items, timestamp: Date.now() });
      return this.filterByArea(items, area);
    } catch (error) {
      this.logger.warn(
        `Falha ao buscar trends (${region}): ${error instanceof Error ? error.message : String(error)}. Usando fallback.`,
      );
      return this.filterByArea(FALLBACK_TRENDS, area);
    }
  }

  async generateAiTopics(
    teacherId: string,
    count: number = 12,
    category?: string,
  ): Promise<string[]> {
    return this.aiService.generateTopicSuggestions({
      teacherId,
      count,
      category,
    });
  }

  getCategories() {
    return [
      { id: 'all', name: 'Todas', keywords: [] },
      ...Object.entries(AREA_KEYWORDS).map(([key, keywords]) => ({
        id: key,
        name: this.getAreaLabel(key),
        keywords,
      })),
    ];
  }

  getGeoOptions() {
    return Object.entries(GEO_LABELS).map(([code, name]) => ({ code, name }));
  }

  private filterByArea(items: TrendItem[], area?: string): TrendItem[] {
    if (!area || area === 'all') return items;
    return items.filter((item) => item.area === area);
  }

  private classifyArea(title: string): string {
    const lower = title.toLowerCase();
    let bestArea = 'education';
    let bestScore = 0;
    for (const [area, keywords] of Object.entries(AREA_KEYWORDS)) {
      const score = keywords.reduce(
        (acc, kw) => acc + (lower.includes(kw) ? 1 : 0),
        0,
      );
      if (score > bestScore) {
        bestScore = score;
        bestArea = area;
      }
    }
    return bestArea;
  }

  private getAreaLabel(area: string): string {
    const labels: Record<string, string> = {
      education: 'Educação',
      business: 'Negócios',
      technology: 'Tecnologia',
      health: 'Saúde',
      entertainment: 'Entretenimento',
    };
    return labels[area] || area;
  }
}
