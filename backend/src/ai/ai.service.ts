import { Injectable, Logger } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CostAction } from '@prisma/client';
import { parseBuffer, parseFile } from 'music-metadata';
import { OpenAI } from 'openai';
import {
  UsageCostService,
  type UsageTrackingContext,
} from './usage-cost.service';
import { CreditsService } from '../credits/credits.service';

type SpeakingEvaluationResult = {
  score: number;
  feedback: string;
  mistakes: string[];
  strengths: string[];
  improvements: string[];
  tips: string[];
  transcription: string;
};

type WhatsappOutboundMessage = {
  kind:
    | 'ANSWER_KEY_HEADER'
    | 'GROUP_GREETING'
    | 'PRIVATE_GREETING'
    | 'SPEAKING_INTRO'
    | 'NEWS_INTRO'
    | 'NEWS'
    | 'QUIZ_HEADER'
    | 'QUIZ_FOOTER'
    | 'QUIZ';
  text: string;
};

type WhatsappOutboundGenerationInput = {
  mode: 'GROUP' | 'PRIVATE';
  model?: string;
  temperature?: number;
  systemPrompt?: string | null;
  ideas?: {
    greetingIdea?: string | null;
    previousQuizHeaderIdea?: string | null;
    challengeIdea?: string | null;
    quizFooterIdea?: string | null;
    newsIntroIdea?: string | null;
  };
  variables: {
    nome?: string | null;
    teacherName?: string | null;
    telefone?: string | null;
    data?: string | null;
    hora?: string | null;
    period?: 'morning' | 'afternoon' | 'evening' | null;
  };
  templates: {
    greeting: string;
    previousQuizHeader?: string;
    speakingIntro?: string;
    newsIntro: string;
    quizHeader?: string;
    quizFooter?: string;
  };
  content: {
    newsTitle: string;
    newsText: string;
    level?: string | null;
    quizQuestions?: unknown;
    previousAnswerKey?: string | null;
  };
  tracking?: UsageTrackingContext;
};

type PrivateBroadcastMessageItem = {
  nome: string;
  whatsapp: string;
  mensagens: Array<{
    tipo: 'GREETING' | 'SPEAKING_INTRO' | 'NEWS_INTRO' | 'NEWS';
    mensagem: string;
  }>;
};

type PrivateBroadcastGenerationInput = {
  model?: string;
  temperature?: number;
  systemPrompt?: string | null;
  modelosDeMensagens: any;
  totalAlunos: number;
  alunos: Array<{
    nome: string;
    whatsapp: string;
    nivel?: string | null;
    variante?: 1 | 2 | 3;
  }>;
  tracking?: UsageTrackingContext;
};

function extractTeacherPhrases(text: string): string[] {
  const matches = [
    ...String(text || '').matchAll(
      /\bTeacher\s+[A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+){0,3}\b/g,
    ),
  ];
  const unique = new Set(matches.map((m) => m[0].trim()).filter(Boolean));
  return [...unique];
}

function extractEmojiSamples(text: string): string[] {
  const matches = [
    ...String(text || '').matchAll(/\p{Extended_Pictographic}/gu),
  ];
  const unique = new Set(matches.map((m) => m[0]).filter(Boolean));
  return [...unique];
}

function extractSignatureLine(text: string): string | null {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const candidate = [...lines]
    .reverse()
    .find((l: string) => /\bTeacher\s+/i.test(l));
  return candidate || null;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private openai: OpenAI;

  constructor(
    private readonly usageCostService: UsageCostService,
    private readonly creditsService: CreditsService,
  ) {
    try {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || 'dummy_key_to_start',
      });
    } catch {
      this.logger.warn(
        'OpenAI API Key não encontrada no .env. Configure para que a IA funcione corretamente.',
      );
    }
  }

  private normalizeFallbackNewsTitle(title: string, levelNumber: string) {
    const base = String(title || '')
      .replace(/\s*[-–—]\s*level\s*\d+\s*$/i, '')
      .trim();
    return `${base} – level ${levelNumber}`.trim();
  }

  private normalizeFallbackNewsContent(content: string) {
    const normalized = String(content || '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\*\*/g, '')
      .trim();

    const markerMatch = normalized.match(/\bDifficult\s+words\s*:/i);
    if (!markerMatch) {
      return normalized;
    }

    const idx = markerMatch.index ?? -1;
    if (idx < 0) {
      return normalized;
    }

    const before = normalized.slice(0, idx).trimEnd();
    const after = normalized.slice(idx).trimStart();
    const afterFixed = after.replace(
      /\bDifficult\s+words\s*:/i,
      'Difficult words:',
    );
    return `${before}\n\n${afterFixed}`.trim();
  }

  private parseFallbackDifficultWords(rawText: string) {
    const normalized = String(rawText || '').trim();
    if (!normalized) return [] as Array<{ term: string; definition: string }>;

    const parenMatches = [...normalized.matchAll(/([^,]+?)\s*\(([^()]*)\)/g)];
    if (parenMatches.length > 0) {
      return parenMatches
        .map((match) => ({
          term: match[1].trim().replace(/^[\-\u2022]\s*/, ''),
          definition: match[2].trim(),
        }))
        .filter((item) => item.term && item.definition);
    }

    const lineMatches = normalized
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.replace(/^[\-\u2022]\s*/, ''))
      .map((line) => {
        const idx = line.indexOf(':');
        if (idx <= 0) return null;
        const term = line.slice(0, idx).trim();
        const definition = line.slice(idx + 1).trim();
        if (!term || !definition) return null;
        return { term, definition };
      })
      .filter(Boolean) as Array<{ term: string; definition: string }>;

    return lineMatches;
  }

  private validateFallbackNewsOutput(input: {
    levelNumber: string;
    title: string;
    content: string;
  }) {
    const violations: string[] = [];
    const title = String(input.title || '').trim();
    const content = String(input.content || '').trim();
    const levelNumber = String(input.levelNumber || '').trim();

    if (!new RegExp(`–\\s*level\\s*${levelNumber}\\s*$`, 'i').test(title)) {
      violations.push('title_suffix');
    }

    const diffMatch = content.match(/\bDifficult\s+words\s*:\s*([\s\S]*)$/i);
    if (!diffMatch) {
      violations.push('missing_difficult_words_section');
      return violations;
    }

    if (!/\n\s*\n\s*\bDifficult\s+words\s*:/i.test(content)) {
      violations.push('missing_blank_line_before_difficult_words');
    }

    const body = content
      .replace(/\bDifficult\s+words\s*:\s*[\s\S]*$/i, '')
      .trim();
    const difficultWordsRaw = diffMatch[1]?.trim() || '';
    const words = this.parseFallbackDifficultWords(difficultWordsRaw);
    if (words.length < 3) {
      violations.push('too_few_difficult_words');
      return violations;
    }

    for (const entry of words) {
      const wordCount = entry.definition
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;
      if (wordCount < 6 || wordCount > 14) {
        violations.push('meaning_length_out_of_range');
        break;
      }
    }

    for (const entry of words) {
      const term = entry.term.trim();
      if (!term) continue;
      if (
        !new RegExp(
          `\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
          'i',
        ).test(body)
      ) {
        violations.push('difficult_word_not_in_body');
        break;
      }
    }

    const normalizedTerms = words
      .map((w) =>
        String(w.term || '')
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean);
    if (new Set(normalizedTerms).size !== normalizedTerms.length) {
      violations.push('duplicate_difficult_words');
    }

    for (const entry of words) {
      const term = String(entry.term || '').trim();
      if (!term) continue;
      const escaped = term
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\s+/g, '\\s+');
      const regex = new RegExp(
        `(^|[^A-Za-z])(${escaped})(?=$|[^A-Za-z])`,
        'gi',
      );
      const occurrences = (body.match(regex) || []).length;
      if (occurrences > 1) {
        violations.push('difficult_word_repeated_in_body');
        break;
      }
    }

    return violations;
  }

  /**
   * Gera uma notícia de fallback caso o scraper falhe.
   */
  async generateFallbackNews(
    level: string,
    tracking?: UsageTrackingContext,
    options?: {
      avoidTitle?: string;
      avoidContent?: string;
    },
  ): Promise<{ title: string; content: string }> {
    this.logger.log(`Gerando notícia via IA para o nível: ${level}`);

    const levelNumber = level.split('_')[1] || '1';
    const avoidTitle = String(options?.avoidTitle || '').trim();
    const avoidContent = String(options?.avoidContent || '').trim();
    const avoidBlock =
      avoidTitle || avoidContent
        ? `\nEvite repetir a notícia abaixo (não reutilize o mesmo título nem o mesmo texto):\n- title: ${avoidTitle || '(vazio)'}\n- content: ${avoidContent ? `${avoidContent.slice(0, 500)}...` : '(vazio)'}\n`
        : '';

    const prompt = `Você é um criador de conteúdo educacional para estudantes de inglês.

Gere uma notícia curta em inglês no MESMO padrão do site "News in Levels".

Regras:
- Nível: ${level} (LEVEL_1 = básico, LEVEL_2 = intermediário, LEVEL_3 = avançado)
- A notícia deve parecer uma notícia real e atual (sem mencionar que foi gerada por IA)
- A saída deve estar no formato JSON com as chaves "title" e "content"
- "title" deve terminar exatamente com "– level ${levelNumber}" (com esse travessão) e ser curto
- "content" deve ser em inglês e conter:
  - 2 a 5 parágrafos curtos, texto contínuo
  - no final, depois de uma linha em branco, uma seção exatamente assim:
    (linha em branco)
    Difficult words: word (meaning), word (meaning), ...
  - "meaning" deve ser uma explicação curta em inglês simples (6 a 14 palavras), mais informativa do que um sinônimo de 1 palavra
  - todas as difficult words precisam aparecer no texto (mesma grafia, pode variar maiúsculas/minúsculas)
  - use 4 a 6 difficult words e não repita palavras na lista
  - cada difficult word deve aparecer apenas 1 vez no texto (não precisa repetir)
  - NÃO use markdown **negrito** no conteúdo; deixe o texto “limpo” (o WhatsApp vai formatar depois)
- Tamanho aproximado:
  - LEVEL_1: 120–170 palavras
  - LEVEL_2: 170–230 palavras
  - LEVEL_3: 220–320 palavras
${avoidBlock}
Retorne SOMENTE o JSON.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: prompt }],
        response_format: { type: 'json_object' },
      });

      await this.usageCostService.recordChatCompletion({
        action: CostAction.NEWS_FALLBACK_GENERATION,
        modelName: 'gpt-4o-mini',
        response,
        tracking: {
          ...tracking,
          referenceType: tracking?.referenceType || 'news_fallback',
          referenceId: tracking?.referenceId || level,
        },
        metadata: { level },
      });

      const result = JSON.parse(
        response.choices[0].message.content || '{}',
      ) as { title?: string; content?: string };
      if (!result.title || !result.content) {
        throw new Error('A IA não retornou o formato esperado.');
      }

      let title = this.normalizeFallbackNewsTitle(result.title, levelNumber);
      let content = this.normalizeFallbackNewsContent(result.content);
      const violations = this.validateFallbackNewsOutput({
        levelNumber,
        title,
        content,
      });

      if (violations.length > 0) {
        const repairPrompt = `${prompt}

Corrija o JSON para ficar exatamente no padrão "News in Levels".
Problemas encontrados: ${violations.join(', ')}
Mantenha o MESMO tema e não invente campos novos.

JSON anterior:
${JSON.stringify({ title, content })}`;

        const repairResponse = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'system', content: repairPrompt }],
          response_format: { type: 'json_object' },
        });

        await this.usageCostService.recordChatCompletion({
          action: CostAction.NEWS_FALLBACK_GENERATION,
          modelName: 'gpt-4o-mini',
          response: repairResponse,
          tracking: {
            ...tracking,
            referenceType: tracking?.referenceType || 'news_fallback',
            referenceId: `${tracking?.referenceId || level}:repair`,
          },
          metadata: { level, repair: true, violations },
        });

        const repaired = JSON.parse(
          repairResponse.choices[0].message.content || '{}',
        ) as { title?: string; content?: string };

        if (repaired.title && repaired.content) {
          title = this.normalizeFallbackNewsTitle(repaired.title, levelNumber);
          content = this.normalizeFallbackNewsContent(repaired.content);
        }
      }

      return {
        title,
        content,
      };
    } catch (error) {
      this.logger.error('Erro ao gerar notícia via IA', error);
      throw error;
    }
  }

  async generateFallbackNewsBundle(
    tracking?: UsageTrackingContext,
    optionsByLevel?: Partial<
      Record<
        'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3',
        { avoidTitle?: string; avoidContent?: string }
      >
    >,
  ): Promise<
    Record<
      'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3',
      { title: string; content: string }
    >
  > {
    this.logger.log(
      'Gerando notícia via IA (bundle LEVEL_1/2/3 com um único tema)',
    );

    const buildAvoid = (level: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3') => {
      const avoidTitle = String(
        optionsByLevel?.[level]?.avoidTitle || '',
      ).trim();
      const avoidContent = String(
        optionsByLevel?.[level]?.avoidContent || '',
      ).trim();
      if (!avoidTitle && !avoidContent) return '';
      const contentPreview = avoidContent
        ? `${avoidContent.slice(0, 500)}...`
        : '(vazio)';
      return `\n- ${level}: title="${avoidTitle || '(vazio)'}" | content="${contentPreview}"`;
    };

    const avoidBlock = [
      buildAvoid('LEVEL_1'),
      buildAvoid('LEVEL_2'),
      buildAvoid('LEVEL_3'),
    ]
      .filter(Boolean)
      .join('');

    const prompt = `Você é um criador de conteúdo educacional para estudantes de inglês.

Gere UMA única notícia (um único tema) e produza 3 versões dela, adaptadas por nível, no MESMO padrão do site "News in Levels".

Regras gerais:
- A notícia deve parecer uma notícia real e atual (sem mencionar que foi gerada por IA)
- As 3 versões devem falar do MESMO acontecimento/fatos, com dificuldade adaptada
- Formato de saída: JSON com as chaves "LEVEL_1", "LEVEL_2", "LEVEL_3". Cada uma deve ter "title" e "content"
- "title" deve terminar exatamente com:
  - LEVEL_1: "– level 1"
  - LEVEL_2: "– level 2"
  - LEVEL_3: "– level 3"
- "content" deve ser em inglês e conter:
  - 2 a 5 parágrafos curtos, texto contínuo
  - no final, depois de uma linha em branco, uma seção exatamente assim:
    (linha em branco)
    Difficult words: word (meaning), word (meaning), ...
  - "meaning" deve ser uma explicação curta em inglês simples (6 a 14 palavras), mais informativa do que um sinônimo de 1 palavra
  - todas as difficult words precisam aparecer no texto (mesma grafia, pode variar maiúsculas/minúsculas)
  - use 4 a 6 difficult words e não repita palavras na lista
  - cada difficult word deve aparecer apenas 1 vez no texto (não precisa repetir)
  - NÃO use markdown **negrito** no conteúdo; deixe o texto “limpo” (o WhatsApp vai formatar depois)
- Tamanho aproximado:
  - LEVEL_1: 120–170 palavras
  - LEVEL_2: 170–230 palavras
  - LEVEL_3: 220–320 palavras
${avoidBlock ? `\nEvite repetir as notícias abaixo (não reutilize os mesmos títulos nem os mesmos textos):${avoidBlock}\n` : ''}
Retorne SOMENTE o JSON.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: prompt }],
      response_format: { type: 'json_object' },
    });

    await this.usageCostService.recordChatCompletion({
      action: CostAction.NEWS_FALLBACK_GENERATION,
      modelName: 'gpt-4o-mini',
      response,
      tracking: {
        ...tracking,
        referenceType: tracking?.referenceType || 'news_fallback',
        referenceId: tracking?.referenceId || 'bundle',
      },
      metadata: {
        mode: 'bundle',
        levels: ['LEVEL_1', 'LEVEL_2', 'LEVEL_3'],
      },
    });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    let level1 = parsed?.LEVEL_1;
    let level2 = parsed?.LEVEL_2;
    let level3 = parsed?.LEVEL_3;
    const isValidItem = (item: any) =>
      item &&
      typeof item.title === 'string' &&
      typeof item.content === 'string' &&
      item.title.trim() &&
      item.content.trim();

    if (!isValidItem(level1) || !isValidItem(level2) || !isValidItem(level3)) {
      throw new Error(
        'A IA não retornou o formato esperado para o bundle de notícias.',
      );
    }

    const normalizeItem = (item: any, levelNumber: string) => ({
      title: this.normalizeFallbackNewsTitle(item.title, levelNumber),
      content: this.normalizeFallbackNewsContent(item.content),
    });

    level1 = normalizeItem(level1, '1');
    level2 = normalizeItem(level2, '2');
    level3 = normalizeItem(level3, '3');

    const violationsByLevel = {
      LEVEL_1: this.validateFallbackNewsOutput({
        levelNumber: '1',
        title: level1.title,
        content: level1.content,
      }),
      LEVEL_2: this.validateFallbackNewsOutput({
        levelNumber: '2',
        title: level2.title,
        content: level2.content,
      }),
      LEVEL_3: this.validateFallbackNewsOutput({
        levelNumber: '3',
        title: level3.title,
        content: level3.content,
      }),
    };

    const needsRepair = Object.values(violationsByLevel).some(
      (violations) => violations.length > 0,
    );

    if (needsRepair) {
      const repairPrompt = `${prompt}

Corrija o JSON para ficar exatamente no padrão "News in Levels".
Problemas encontrados:
- LEVEL_1: ${violationsByLevel.LEVEL_1.join(', ') || 'ok'}
- LEVEL_2: ${violationsByLevel.LEVEL_2.join(', ') || 'ok'}
- LEVEL_3: ${violationsByLevel.LEVEL_3.join(', ') || 'ok'}
Mantenha o MESMO tema e não invente campos novos.

JSON anterior:
${JSON.stringify({ LEVEL_1: level1, LEVEL_2: level2, LEVEL_3: level3 })}`;

      const repairResponse = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: repairPrompt }],
        response_format: { type: 'json_object' },
      });

      await this.usageCostService.recordChatCompletion({
        action: CostAction.NEWS_FALLBACK_GENERATION,
        modelName: 'gpt-4o-mini',
        response: repairResponse,
        tracking: {
          ...tracking,
          referenceType: tracking?.referenceType || 'news_fallback',
          referenceId: `${tracking?.referenceId || 'bundle'}:repair`,
        },
        metadata: { mode: 'bundle', repair: true, violationsByLevel },
      });

      const repaired = JSON.parse(
        repairResponse.choices[0].message.content || '{}',
      );
      const r1 = repaired?.LEVEL_1;
      const r2 = repaired?.LEVEL_2;
      const r3 = repaired?.LEVEL_3;
      if (isValidItem(r1) && isValidItem(r2) && isValidItem(r3)) {
        level1 = normalizeItem(r1, '1');
        level2 = normalizeItem(r2, '2');
        level3 = normalizeItem(r3, '3');
      }
    }

    return {
      LEVEL_1: { title: level1.title, content: level1.content },
      LEVEL_2: { title: level2.title, content: level2.content },
      LEVEL_3: { title: level3.title, content: level3.content },
    };
  }

  /**
   * Gera um quiz baseado no conteúdo da notícia.
   */
  async generateQuiz(
    newsText: string,
    tracking?: UsageTrackingContext,
  ): Promise<any[]> {
    this.logger.log('Gerando quiz via IA para a notícia...');

    const prompt = `Você é um professor de inglês.

Com base na notícia abaixo, gere:
- 3 perguntas de interpretação em inglês. As perguntas devem obrigatoriamente começar com o número (ex: "1. Qual é o tema...", "2. Onde ocorreu...", "3. Quem fez...").
- 3 alternativas por pergunta. As alternativas devem obrigatoriamente começar com letras maiúsculas seguidas de hífen (ex: "A - primeira opção", "B - segunda opção", "C - terceira opção").
- Informe a resposta correta exatamente igual a uma das alternativas (incluindo a letra).

Texto:
${newsText}

Formato de saída: JSON com a chave "questions" contendo um array de objetos. 
Cada objeto deve ter: "question", "options" (array de strings no formato "A - ..."), e "correct_answer" (string).`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: prompt }],
        response_format: { type: 'json_object' },
      });

      await this.usageCostService.recordChatCompletion({
        action: CostAction.QUIZ_GENERATION,
        modelName: 'gpt-4o-mini',
        response,
        tracking: {
          ...tracking,
          referenceType: tracking?.referenceType || 'quiz_generation',
          referenceId: tracking?.referenceId || tracking?.newsId || null,
        },
      });

      const result = JSON.parse(
        response.choices[0].message.content || '{}',
      ) as {
        questions?: Array<{
          question: string;
          options: string[];
          correct_answer: string;
        }>;
      };
      return result.questions || [];
    } catch (error) {
      this.logger.error('Erro ao gerar quiz via IA', error);
      throw error;
    }
  }

  async interpretQuizAnswers(
    rawText: string,
    totalQuestions: number,
    tracking?: UsageTrackingContext,
  ): Promise<{ questionIndex: number; selectedAnswer: string }[] | null> {
    this.logger.log('Interpretando respostas de quiz via IA...');

    const prompt = `Você é um interpretador de respostas de quiz de alunos de inglês.

O aluno respondeu a um quiz com ${totalQuestions} perguntas, cada uma com alternativas A, B ou C.

O texto abaixo é a resposta do aluno. Pode vir em vários formatos, como:
- "A, B, C" ou "A B C" ou "A,B,C"
- "1A, 2B, 3C" ou "1-A, 2-B, 3-C" ou "1a 2b 3c"
- "a, b, c" (lowercase)
- "B, B, C" (respostas repetidas)
- "1. A 2. B 3. C" ou "1 - A, 2 - B, 3 - C"
- Qualquer outro formato que represente respostas

Sua tarefa é extrair a resposta de CADA pergunta (da 1 à ${totalQuestions}) e retornar um array JSON.

Regras:
- Se o aluno não respondeu uma pergunta, coloque null para aquela posição
- Normalize todas as respostas para letra maiúscula (A, B ou C)
- Se houver ambiguidade, prefira a interpretação mais provável
- Se o texto não parecer respostas de quiz, retorne null

Texto do aluno:
${rawText}

Formato de saída: JSON EXATO no formato:
{"answers": [{"questionIndex": 0, "selectedAnswer": "A"}, ...]}

Use questionIndex 0-based (0 = pergunta 1, 1 = pergunta 2, etc.).
Se não conseguir interpretar, retorne: {"answers": null}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: prompt }],
        response_format: { type: 'json_object' },
      });

      await this.usageCostService.recordChatCompletion({
        action: CostAction.QUIZ_GENERATION,
        modelName: 'gpt-4o-mini',
        response,
        tracking,
      });

      const result = JSON.parse(
        response.choices[0].message.content || '{}',
      ) as {
        answers: { questionIndex: number; selectedAnswer: string }[] | null;
      };

      if (!result.answers || !Array.isArray(result.answers)) {
        return null;
      }

      return result.answers.filter(
        (a) => a.selectedAnswer && a.questionIndex >= 0,
      );
    } catch (error) {
      this.logger.error('Erro ao interpretar respostas de quiz via IA', error);
      return null;
    }
  }

  async classifyYesNo(
    text: string,
    tracking?: UsageTrackingContext,
  ): Promise<'YES' | 'NO' | 'UNKNOWN'> {
    const cleaned = String(text || '')
      .trim()
      .toLowerCase();
    if (!cleaned) return 'UNKNOWN';

    const hasYesKeyword =
      /\b(yes|yep|yeah|sim|confirmo|confirmar|ok|okay|beleza|bora|vamos|com certeza|pode ser|pode confirmar)\b/i.test(
        cleaned,
      );
    const hasNoKeyword =
      /\b(no|nope|nao|não|recuso|cancelar|cancelo|negativo|de jeito nenhum|impossivel|hoje não|nao vou poder)\b/i.test(
        cleaned,
      );

    if (!hasYesKeyword && !hasNoKeyword) {
      return 'UNKNOWN';
    }

    const prompt = `Você é um classificador de respostas curtas.

Tarefa:
- Dado um texto, classifique como confirmação (YES), recusa (NO) ou incerto (UNKNOWN).

Regras:
- Respostas como "yes", "sim", "ok", "confirmo", "com certeza" => YES
- Respostas como "no", "não", "recuso", "cancelo", "hoje não" => NO
- Qualquer outra coisa => UNKNOWN

Retorne SOMENTE JSON no formato: {"decision":"YES"|"NO"|"UNKNOWN"}

Texto:
${cleaned}`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: prompt }],
      response_format: { type: 'json_object' },
    });

    await this.usageCostService.recordChatCompletion({
      action: CostAction.WHATSAPP_MESSAGE_GENERATION,
      modelName: 'gpt-4o-mini',
      response,
      tracking: {
        ...tracking,
        referenceType: tracking?.referenceType || 'yes_no_classification',
        referenceId: tracking?.referenceId || null,
      },
      metadata: { kind: 'yes_no_classification' },
    });

    const parsed = JSON.parse(response.choices[0].message.content || '{}') as {
      decision?: string;
    };
    const decision = String(parsed.decision || '').toUpperCase();
    if (decision === 'YES' || decision === 'NO') return decision;
    return 'UNKNOWN';
  }

  async generateLessonConfirmationMessage(input: {
    idea: string;
    variables: Record<string, string>;
    tracking?: UsageTrackingContext;
    model?: string;
    temperature?: number;
  }) {
    const idea = String(input.idea || '').trim();
    const variables = input.variables || {};
    const model = String(input.model || 'gpt-4o-mini');
    const temperature =
      typeof input.temperature === 'number' &&
      Number.isFinite(input.temperature)
        ? input.temperature
        : 0.7;

    const prompt = `Você escreve mensagens de WhatsApp para confirmação de aula.

Use esta "ideia" como referência de estilo (não copie literalmente se não fizer sentido, mas mantenha o tom e emojis):
${idea}

Dados reais para usar:
${Object.entries(variables)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join('\n')}

Regras:
- Retorne uma mensagem curta, clara e amigável.
- A mensagem deve pedir confirmação da aula de hoje usando o dia e horário informados.
- Não use placeholders do tipo {{variavel}} no texto final.
- Não inclua JSON no texto final.

Retorne SOMENTE JSON no formato: {"message":"..."};`;

    const response = await this.openai.chat.completions.create({
      model,
      temperature,
      messages: [{ role: 'system', content: prompt }],
      response_format: { type: 'json_object' },
    });

    await this.usageCostService.recordChatCompletion({
      action: CostAction.WHATSAPP_MESSAGE_GENERATION,
      modelName: model,
      response,
      tracking: {
        ...input.tracking,
        referenceType:
          input.tracking?.referenceType || 'lesson_confirmation_message',
        referenceId: input.tracking?.referenceId || null,
      },
      metadata: { kind: 'lesson_confirmation_message' },
    });

    const parsed = JSON.parse(response.choices[0].message.content || '{}') as {
      message?: string;
    };

    return String(parsed.message || '').trim();
  }

  async generateWhatsappOutboundMessages(
    input: WhatsappOutboundGenerationInput,
  ): Promise<WhatsappOutboundMessage[]> {
    const model = input.model || 'gpt-4o-mini';
    const temperature =
      typeof input.temperature === 'number' &&
      Number.isFinite(input.temperature)
        ? input.temperature
        : 0.7;

    const greetingIdea = String(input.ideas?.greetingIdea || '').trim();
    const previousQuizHeaderIdea = String(
      input.ideas?.previousQuizHeaderIdea || '',
    ).trim();
    const challengeIdea = String(input.ideas?.challengeIdea || '').trim();
    const quizFooterIdea = String(input.ideas?.quizFooterIdea || '').trim();
    const newsIntroIdea = String(input.ideas?.newsIntroIdea || '').trim();
    const defaultIdea =
      'Crie mensagens curtas, claras e motivacionais no estilo WhatsApp. Use inglês como idioma principal e, quando fizer sentido, inclua uma linha em português brasileiro para ajudar alunos. Evite textos longos.';
    const hasAnyIdea = Boolean(
      greetingIdea ||
      previousQuizHeaderIdea ||
      challengeIdea ||
      quizFooterIdea ||
      newsIntroIdea,
    );
    const effectiveIdeas = hasAnyIdea
      ? {
          greeting: greetingIdea || null,
          previous_quiz_header: previousQuizHeaderIdea || null,
          challenge: challengeIdea || null,
          quiz_footer: quizFooterIdea || null,
          news_intro: newsIntroIdea || null,
        }
      : {
          greeting: defaultIdea,
          previous_quiz_header: defaultIdea,
          challenge: defaultIdea,
          quiz_footer: defaultIdea,
          news_intro: defaultIdea,
        };

    const requiredPhrasesByKind: Record<string, string[]> = {};
    const signatureLinesByKind: Record<string, string> = {};

    const addRequiredPhrasesForKind = (kind: string, sources: string[]) => {
      const combined = sources
        .map((s) => String(s || '').trim())
        .filter(Boolean)
        .join('\n');
      const phrases = extractTeacherPhrases(combined);
      if (phrases.length > 0) {
        if (!requiredPhrasesByKind[kind]) requiredPhrasesByKind[kind] = [];
        requiredPhrasesByKind[kind].push(...phrases);
      }
    };

    if (input.mode === 'PRIVATE') {
      addRequiredPhrasesForKind('PRIVATE_GREETING', [
        greetingIdea,
        String((input.templates as any)?.greeting || ''),
      ]);
      addRequiredPhrasesForKind('SPEAKING_INTRO', [
        challengeIdea,
        String((input.templates as any)?.speakingIntro || ''),
      ]);
      addRequiredPhrasesForKind('NEWS_INTRO', [
        newsIntroIdea,
        String((input.templates as any)?.newsIntro || ''),
      ]);

      const greetingSig = extractSignatureLine(greetingIdea);
      if (greetingSig) signatureLinesByKind.PRIVATE_GREETING = greetingSig;
      const challengeSig = extractSignatureLine(challengeIdea);
      if (challengeSig) signatureLinesByKind.SPEAKING_INTRO = challengeSig;
      const newsIntroSig = extractSignatureLine(newsIntroIdea);
      if (newsIntroSig) signatureLinesByKind.NEWS_INTRO = newsIntroSig;
    } else {
      addRequiredPhrasesForKind('GROUP_GREETING', [
        greetingIdea,
        String((input.templates as any)?.greeting || ''),
      ]);
      addRequiredPhrasesForKind('QUIZ_HEADER', [
        challengeIdea,
        String((input.templates as any)?.quizHeader || ''),
      ]);
      addRequiredPhrasesForKind('NEWS_INTRO', [
        newsIntroIdea,
        String((input.templates as any)?.newsIntro || ''),
      ]);
      if (input.content.previousAnswerKey) {
        addRequiredPhrasesForKind('ANSWER_KEY_HEADER', [
          previousQuizHeaderIdea,
          String((input.templates as any)?.previousQuizHeader || ''),
        ]);
        addRequiredPhrasesForKind('QUIZ_FOOTER', [
          quizFooterIdea,
          String((input.templates as any)?.quizFooter || ''),
        ]);
      }

      const greetingSig = extractSignatureLine(greetingIdea);
      if (greetingSig) signatureLinesByKind.GROUP_GREETING = greetingSig;
      const challengeSig = extractSignatureLine(challengeIdea);
      if (challengeSig) signatureLinesByKind.QUIZ_HEADER = challengeSig;
      const newsIntroSig = extractSignatureLine(newsIntroIdea);
      if (newsIntroSig) signatureLinesByKind.NEWS_INTRO = newsIntroSig;
      if (input.content.previousAnswerKey) {
        const previousQuizSig = extractSignatureLine(previousQuizHeaderIdea);
        if (previousQuizSig)
          signatureLinesByKind.ANSWER_KEY_HEADER = previousQuizSig;
        const quizFooterSig = extractSignatureLine(quizFooterIdea);
        if (quizFooterSig) signatureLinesByKind.QUIZ_FOOTER = quizFooterSig;
      }
    }

    const requiredEmojisByKind: Record<string, string[]> = {};
    const addRequiredEmojis = (kind: string, sources: string[]) => {
      const emojis = sources
        .map((s) => extractEmojiSamples(s))
        .flat()
        .filter(Boolean);
      const unique = [...new Set(emojis)];
      if (unique.length > 0) {
        requiredEmojisByKind[kind] = unique;
      }
    };

    if (input.mode === 'PRIVATE') {
      addRequiredEmojis('PRIVATE_GREETING', [
        String(effectiveIdeas.greeting || ''),
        String((input.templates as any)?.greeting || ''),
      ]);
      addRequiredEmojis('SPEAKING_INTRO', [
        String(effectiveIdeas.challenge || ''),
        String((input.templates as any)?.speakingIntro || ''),
      ]);
      addRequiredEmojis('NEWS_INTRO', [
        String(effectiveIdeas.news_intro || ''),
        String((input.templates as any)?.newsIntro || ''),
      ]);
    } else {
      addRequiredEmojis('GROUP_GREETING', [
        String(effectiveIdeas.greeting || ''),
        String((input.templates as any)?.greeting || ''),
      ]);
      addRequiredEmojis('ANSWER_KEY_HEADER', [
        String(effectiveIdeas.previous_quiz_header || ''),
        String((input.templates as any)?.previousQuizHeader || ''),
      ]);
      addRequiredEmojis('NEWS_INTRO', [
        String(effectiveIdeas.news_intro || ''),
        String((input.templates as any)?.newsIntro || ''),
      ]);
      addRequiredEmojis('QUIZ_HEADER', [
        String(effectiveIdeas.challenge || ''),
        String((input.templates as any)?.quizHeader || ''),
      ]);
      addRequiredEmojis('QUIZ_FOOTER', [
        String(effectiveIdeas.quiz_footer || ''),
        String((input.templates as any)?.quizFooter || ''),
      ]);
    }

    const systemPrompt = `${input.systemPrompt || 'Você é um professor de inglês e assistente do Talkion.'}

Tarefa:
- Gerar as mensagens que serão enviadas no WhatsApp.
- Modo: ${input.mode}

Importante:
- Use as templates fornecidas como referência forte de tom e estrutura.
- Seja fiel ao estilo e à estrutura do TEMPLATE (não precisa ser idêntico, mas deve parecer muito parecido).
- Se houver um nome do professor em VARIABLES.teacherName, considere esse nome na redação quando fizer sentido (ex: assinatura, referência ao professor, tom do template/ideia). Não invente nomes.
- Se CONSTRAINTS.requiredPhrasesByKind tiver valores para um kind, inclua essas frases literalmente (sem alterar/remover), principalmente nomes próprios (ex: "Teacher Juliano").
- Use as "IDEIAS" por bloco para personalizar e adaptar cada mensagem:
  - greeting -> (GROUP_GREETING ou PRIVATE_GREETING)
  - previous_quiz_header -> (ANSWER_KEY_HEADER, apenas se existir previousAnswerKey no CONTEÚDO e modo = GROUP)
  - challenge -> (SPEAKING_INTRO no privado, QUIZ_HEADER no grupo)
  - quiz_footer -> (QUIZ_FOOTER, apenas no modo = GROUP)
  - news_intro -> (NEWS_INTRO)
- Retorne SOMENTE JSON no formato: {"messages":[{"kind":"...","text":"..."}]}
- kind deve ser um destes: ANSWER_KEY_HEADER, GROUP_GREETING, PRIVATE_GREETING, SPEAKING_INTRO, NEWS_INTRO, NEWS, QUIZ_HEADER, QUIZ, QUIZ_FOOTER
- Se modo = PRIVATE, não retorne GROUP_GREETING e QUIZ/QUIZ_HEADER.
- Se modo = GROUP, não retorne PRIVATE_GREETING e SPEAKING_INTRO.
- Se modo = GROUP, retorne QUIZ (perguntas) sem o rodapé; retorne o rodapé em QUIZ_FOOTER.
- Cada text deve estar pronto para envio, com formatação do WhatsApp quando útil (*negrito*, _itálico_, etc).
- Não use placeholders tipo {{nome}}; use os valores reais recebidos em VARIABLES quando existirem.
- Não inclua nada fora do JSON.`;

    const userPrompt = `IDEIAS:
${JSON.stringify(effectiveIdeas)}

VARIABLES:
${JSON.stringify(input.variables)}

TEMPLATES:
${JSON.stringify(input.templates)}

CONSTRAINTS:
${JSON.stringify({ requiredPhrasesByKind: requiredPhrasesByKind, requiredEmojisByKind })}

CONTEÚDO:
${JSON.stringify(input.content)}`;

    const response = await this.openai.chat.completions.create({
      model,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    });

    await this.usageCostService.recordChatCompletion({
      action: CostAction.WHATSAPP_MESSAGE_GENERATION,
      modelName: model,
      response,
      tracking: {
        ...input.tracking,
        referenceType:
          input.tracking?.referenceType || 'whatsapp_message_generation',
        referenceId: input.tracking?.referenceId || null,
      },
      metadata: {
        mode: input.mode,
      },
    });

    const parsed = JSON.parse(response.choices[0].message.content || '{}') as {
      messages?: WhatsappOutboundMessage[];
    };

    if (!Array.isArray(parsed.messages)) {
      return [];
    }

    const allowedKinds = new Set<WhatsappOutboundMessage['kind']>([
      'ANSWER_KEY_HEADER',
      'GROUP_GREETING',
      'PRIVATE_GREETING',
      'SPEAKING_INTRO',
      'NEWS_INTRO',
      'NEWS',
      'QUIZ_HEADER',
      'QUIZ_FOOTER',
      'QUIZ',
    ]);

    const messages = parsed.messages
      .filter((m: any) => m && typeof m === 'object')
      .map((m: any) => ({
        kind: m.kind,
        text: String(m.text || '').trim(),
      }))
      .filter((m: any) => allowedKinds.has(m.kind) && m.text.length > 0);

    return messages.map((msg) => {
      let text = msg.text;

      const requiredPhrases = requiredPhrasesByKind[msg.kind] || [];
      if (requiredPhrases.length > 0) {
        const missing = requiredPhrases.filter((p) => !text.includes(p));
        if (missing.length > 0) {
          const signatureLine = signatureLinesByKind[msg.kind];
          if (signatureLine && !text.includes(signatureLine)) {
            text = `${text}\n\n${signatureLine}`;
          }
        }
      }

      const requiredEmojis = requiredEmojisByKind[msg.kind] || [];
      if (requiredEmojis.length > 0) {
        const hasAnyRequiredEmoji = requiredEmojis.some((e) =>
          text.includes(e),
        );
        if (!hasAnyRequiredEmoji) {
          text = `${text} ${requiredEmojis[0]}`.trim();
        }
      }

      return { ...msg, text };
    });
  }

  async generatePrivateBroadcastMessages(
    input: PrivateBroadcastGenerationInput,
  ): Promise<PrivateBroadcastMessageItem[]> {
    const model = input.model || 'gpt-4o-mini';
    const temperature =
      typeof input.temperature === 'number' &&
      Number.isFinite(input.temperature)
        ? input.temperature
        : 0.7;

    const keys = input.alunos.map((a) => ({
      nome: a.nome,
      whatsapp: a.whatsapp,
    }));

    const requiredPhrasesByTipo: Record<string, string[]> = {};
    const requiredEmojisByTipo: Record<string, string[]> = {};
    const signatureLinesByTipo: Record<string, string> = {};

    const greetingModel = String(input.modelosDeMensagens?.greeting || '');
    const challengeModel = String(input.modelosDeMensagens?.challenge || '');
    const newsIntroModel = String(input.modelosDeMensagens?.news_intro || '');

    const greetingPhrases = extractTeacherPhrases(greetingModel);
    if (greetingPhrases.length > 0) {
      requiredPhrasesByTipo.GREETING = greetingPhrases;
    }

    const challengePhrases = extractTeacherPhrases(challengeModel);
    if (challengePhrases.length > 0) {
      requiredPhrasesByTipo.SPEAKING_INTRO = challengePhrases;
    }

    const newsIntroPhrases = extractTeacherPhrases(newsIntroModel);
    if (newsIntroPhrases.length > 0) {
      requiredPhrasesByTipo.NEWS_INTRO = newsIntroPhrases;
    }

    const greetingSignature = extractSignatureLine(greetingModel);
    if (greetingSignature) signatureLinesByTipo.GREETING = greetingSignature;

    const challengeSignature = extractSignatureLine(challengeModel);
    if (challengeSignature)
      signatureLinesByTipo.SPEAKING_INTRO = challengeSignature;

    const newsIntroSignature = extractSignatureLine(newsIntroModel);
    if (newsIntroSignature)
      signatureLinesByTipo.NEWS_INTRO = newsIntroSignature;

    const speakingEmojis = extractEmojiSamples(challengeModel);
    if (speakingEmojis.length > 0) {
      requiredEmojisByTipo.SPEAKING_INTRO = speakingEmojis;
    }

    const greetingEmojiSamples = extractEmojiSamples(greetingModel);
    if (greetingEmojiSamples.length > 0) {
      requiredEmojisByTipo.GREETING = greetingEmojiSamples;
    }

    const newsIntroEmojiSamples = extractEmojiSamples(newsIntroModel);
    if (newsIntroEmojiSamples.length > 0) {
      requiredEmojisByTipo.NEWS_INTRO = newsIntroEmojiSamples;
    }

    const systemPrompt = `${input.systemPrompt || 'Você é um assistente do Talkion.'}

Objetivo:
- Gerar mensagens personalizadas para CADA aluno, para envio no WhatsApp (privado), em BLOCOS separados.

Entrada:
- modelos de mensagens (MODELOS)
- total de alunos (TOTAL)
- lista de alunos (ALUNOS)

Regras obrigatórias da resposta:
- Retorne SOMENTE JSON válido.
- Estrutura exata:
{
  "mensagens": [
    {
      "nome": "Nome do aluno",
      "whatsapp": "Número do WhatsApp do aluno",
      "mensagens": [
        { "tipo": "GREETING", "mensagem": "..." },
        { "tipo": "SPEAKING_INTRO", "mensagem": "..." },
        { "tipo": "NEWS_INTRO", "mensagem": "..." },
        { "tipo": "NEWS", "mensagem": "..." }
      ]
    }
  ]
}
- Não adicione campos extras.
- Não retorne texto fora do JSON.
- O campo "nome" deve ser exatamente igual ao nome enviado (mesmos caracteres, acentos e espaços).
- O campo "whatsapp" deve ser exatamente igual ao whatsapp enviado.
- Deve existir exatamente 1 item para cada aluno fornecido em ALUNOS (mesma quantidade).
- Em "mensagens", sempre retorne exatamente 4 itens, nesta ordem:
  1) GREETING
  2) SPEAKING_INTRO
  3) NEWS_INTRO
  4) NEWS

Conteúdo:
- Use WhatsApp formatting quando fizer sentido (*negrito*, _itálico_, etc).
- Cada bloco deve seguir os MODELOS e ser coerente com o contexto fornecido neles.
- Seja fiel ao estilo e à estrutura do MODELO (não precisa ser idêntico, mas deve parecer muito parecido).
- Se o MODELO trouxer emojis, mantenha emojis na mensagem (não transforme em texto “seco”).
- Se CONSTRAINTS.requiredPhrasesByTipo tiver valores para um tipo, inclua essas frases literalmente (sem alterar/remover), principalmente nomes próprios (ex: "Teacher Juliano").
- Não inclua placeholders tipo {{nome}}; use os valores reais quando existirem em MODELOS/ALUNOS.`;

    const variationRules = `

Personalização (IMPORTANTE):
- As mensagens não podem ficar idênticas entre alunos diferentes.
- Use sempre o nome do aluno no bloco GREETING.
- Use o campo "variante" (1, 2 ou 3) enviado em ALUNOS para variar frase, tom e/ou emoji.
- Para alunos com variantes diferentes, garanta que pelo menos o GREETING e o SPEAKING_INTRO sejam diferentes.
- Evite inventar fatos sobre o aluno. Personalize com variações leves (1 frase/emoji) e tom motivacional.`;

    const userPrompt = `MODELOS:
${JSON.stringify(input.modelosDeMensagens)}

CONSTRAINTS:
${JSON.stringify({ requiredPhrasesByTipo, requiredEmojisByTipo })}

TOTAL:
${input.totalAlunos}

ALUNOS:
${JSON.stringify(input.alunos)}

CHAVES_EXATAS (use exatamente como está):
${JSON.stringify(keys)}${variationRules}`;

    const response = await this.openai.chat.completions.create({
      model,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    });

    await this.usageCostService.recordChatCompletion({
      action: CostAction.WHATSAPP_MESSAGE_GENERATION,
      modelName: model,
      response,
      tracking: {
        ...input.tracking,
        referenceType:
          input.tracking?.referenceType ||
          'whatsapp_private_broadcast_generation',
        referenceId: input.tracking?.referenceId || null,
      },
      metadata: {
        totalAlunos: input.totalAlunos,
      },
    });

    const parsed = JSON.parse(response.choices[0].message.content || '{}') as {
      mensagens?: unknown;
    };

    if (!Array.isArray((parsed as any).mensagens)) {
      return [];
    }

    return (parsed as any).mensagens
      .filter((item: any) => item && typeof item === 'object')
      .map((item: any) => ({
        nome: String(item.nome ?? ''),
        whatsapp: String(item.whatsapp ?? ''),
        mensagens: Array.isArray(item.mensagens)
          ? item.mensagens
              .filter((m: any) => m && typeof m === 'object')
              .map((m: any) => ({
                tipo: m.tipo,
                mensagem: String(m.mensagem ?? ''),
              }))
          : [],
      }))
      .map((item: any) => {
        const patched = item.mensagens.map((m: any) => {
          const tipo = String(m.tipo || '');
          let mensagem = String(m.mensagem ?? '').trim();
          if (!mensagem) return { ...m, mensagem };

          const requiredPhrases = requiredPhrasesByTipo[tipo] || [];
          if (requiredPhrases.length > 0) {
            const missing = requiredPhrases.filter(
              (p) => !mensagem.includes(p),
            );
            if (missing.length > 0) {
              const signatureLine = signatureLinesByTipo[tipo];
              if (signatureLine && !mensagem.includes(signatureLine)) {
                mensagem = `${mensagem}\n\n${signatureLine}`;
              }
            }
          }

          const requiredEmojis = requiredEmojisByTipo[tipo] || [];
          if (requiredEmojis.length > 0) {
            const hasAnyRequiredEmoji = requiredEmojis.some((e) =>
              mensagem.includes(e),
            );
            if (!hasAnyRequiredEmoji) {
              mensagem = `${mensagem} ${requiredEmojis[0]}`.trim();
            }
          }

          return { ...m, mensagem };
        });

        return { ...item, mensagens: patched };
      })
      .filter(
        (item: any) => item.nome && item.whatsapp && item.mensagens.length > 0,
      );
  }

  /**
   * Avalia o áudio do aluno (Speaking) transcrevendo com Whisper e avaliando com GPT.
   */
  async evaluateSpeaking(
    originalText: string,
    audioBase64: string,
    mimeType?: string,
    tracking?: UsageTrackingContext,
  ): Promise<SpeakingEvaluationResult> {
    const teachId = tracking?.teacherId;
    await this.creditsService.requireCredits(
      teachId as string,
      'speaking_transcription',
    );
    await this.creditsService.requireCredits(
      teachId as string,
      'speaking_feedback',
    );

    const { buffer, extension } = this.decodeAudioBase64(audioBase64, mimeType);
    const tempDir = await mkdtemp(join(tmpdir(), 'talkion-audio-'));
    const tempFilePath = join(tempDir, `submission.${extension}`);

    const prompt = `Você é um professor de inglês especializado em speaking.

Compare:
Texto original:
${originalText}`;

    try {
      await writeFile(tempFilePath, buffer);
      const resolvedAudioSeconds = await this.resolveAudioSeconds(
        buffer,
        tempFilePath,
        mimeType,
        tracking?.audioSeconds,
      );

      const transcriptionResponse =
        await this.openai.audio.transcriptions.create({
          file: createReadStream(tempFilePath),
          model: 'whisper-1',
        });

      await this.usageCostService.recordWhisperTranscription({
        tracking: {
          ...tracking,
          audioSeconds: resolvedAudioSeconds,
          referenceType: tracking?.referenceType || 'speaking_transcription',
          referenceId: tracking?.referenceId || tracking?.newsId || null,
        },
      });

      const studentTranscription = transcriptionResponse.text?.trim();
      if (!studentTranscription) {
        throw new Error('A transcrição do áudio retornou vazia.');
      }

      const evaluationPrompt = `${prompt}

Transcrição do aluno:
${studentTranscription}

Gere:
- Nota de 0 a 10 (score)
- Um resumo curto e amigável em português brasileiro (feedback)
- O que você fez bem em um array (strengths), em português brasileiro
- O que precisa melhorar em um array (improvements), em português brasileiro
- Como falar melhor em um array (tips), em português brasileiro
- Principais erros em um array (mistakes), mantendo em inglês apenas as palavras, expressões ou trechos do aluno que precisam de correção

Formato de saída: JSON contendo "score", "feedback", "strengths", "improvements", "tips" e "mistakes".`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: evaluationPrompt }],
        response_format: { type: 'json_object' },
      });

      await this.usageCostService.recordChatCompletion({
        action: CostAction.SPEAKING_EVALUATION,
        modelName: 'gpt-4o-mini',
        response,
        tracking: {
          ...tracking,
          referenceType: tracking?.referenceType || 'speaking_evaluation',
          referenceId: tracking?.referenceId || tracking?.newsId || null,
        },
      });

      const parsed = JSON.parse(
        response.choices[0].message.content || '{}',
      ) as {
        score?: number;
        feedback?: string;
        mistakes?: string[];
        strengths?: string[];
        improvements?: string[];
        tips?: string[];
      };

      if (teachId) {
        await this.creditsService.deductCredits(
          teachId,
          'speaking_transcription',
        );
        await this.creditsService.deductCredits(teachId, 'speaking_feedback');
      }

      return {
        score:
          typeof parsed.score === 'number' && Number.isFinite(parsed.score)
            ? parsed.score
            : 0,
        feedback:
          this.normalizeFeedbackText(parsed.feedback) || 'Sem feedback.',
        mistakes: Array.isArray(parsed.mistakes)
          ? parsed.mistakes
              .map((mistake) => this.normalizeFeedbackText(String(mistake)))
              .filter(Boolean)
          : [],
        strengths: Array.isArray(parsed.strengths)
          ? parsed.strengths
              .map((item) => this.normalizeFeedbackText(String(item)))
              .filter(Boolean)
          : [],
        improvements: Array.isArray(parsed.improvements)
          ? parsed.improvements
              .map((item) => this.normalizeFeedbackText(String(item)))
              .filter(Boolean)
          : [],
        tips: Array.isArray(parsed.tips)
          ? parsed.tips
              .map((item) => this.normalizeFeedbackText(String(item)))
              .filter(Boolean)
          : [],
        transcription: studentTranscription,
      };
    } catch (error) {
      this.logger.error('Erro ao avaliar speaking via IA', error);
      throw error;
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private decodeAudioBase64(audioBase64: string, mimeType?: string) {
    const trimmedAudio = audioBase64.trim();
    const dataUriMatch = trimmedAudio.match(
      /^data:(audio\/[-+\w.]+);base64,(.+)$/i,
    );
    const effectiveMimeType = dataUriMatch?.[1] || mimeType || 'audio/ogg';
    const base64Content = dataUriMatch?.[2] || trimmedAudio;

    return {
      buffer: Buffer.from(base64Content, 'base64'),
      extension: this.getAudioExtension(effectiveMimeType),
    };
  }

  private async resolveAudioSeconds(
    buffer: Buffer,
    filePath: string,
    mimeType?: string,
    fallbackSeconds?: number | null,
  ) {
    if (typeof fallbackSeconds === 'number' && fallbackSeconds > 0) {
      return Number(fallbackSeconds.toFixed(3));
    }

    try {
      const metadata = await parseFile(filePath, { duration: true });
      const durationSeconds = metadata.format.duration;

      if (
        typeof durationSeconds === 'number' &&
        Number.isFinite(durationSeconds)
      ) {
        return Math.max(0.001, Number(durationSeconds.toFixed(3)));
      }
    } catch (error) {
      this.logger.warn(
        `Nao foi possivel identificar a duracao do audio pelo arquivo: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    try {
      const normalizedMimeType = mimeType?.split(';')[0]?.trim() || undefined;
      const metadata = await parseBuffer(
        buffer,
        normalizedMimeType ? { mimeType: normalizedMimeType } : undefined,
        { duration: true },
      );
      const durationSeconds = metadata.format.duration;

      if (
        typeof durationSeconds === 'number' &&
        Number.isFinite(durationSeconds)
      ) {
        return Math.max(0.001, Number(durationSeconds.toFixed(3)));
      }
    } catch (error) {
      this.logger.warn(
        `Nao foi possivel identificar a duracao do audio automaticamente: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return 0;
  }

  private getAudioExtension(mimeType: string) {
    const normalizedMimeType = mimeType.toLowerCase();

    if (normalizedMimeType.includes('ogg')) {
      return 'ogg';
    }

    if (
      normalizedMimeType.includes('mpeg') ||
      normalizedMimeType.includes('mp3')
    ) {
      return 'mp3';
    }

    if (
      normalizedMimeType.includes('mp4') ||
      normalizedMimeType.includes('m4a') ||
      normalizedMimeType.includes('aac')
    ) {
      return 'm4a';
    }

    if (normalizedMimeType.includes('wav')) {
      return 'wav';
    }

    if (normalizedMimeType.includes('webm')) {
      return 'webm';
    }

    return 'ogg';
  }

  async generateNewsAudio(
    newsContent: string,
    tracking?: UsageTrackingContext,
  ): Promise<Buffer> {
    const body = this.extractNewsBody(newsContent);
    const response = await this.openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: body,
    });

    await this.usageCostService.recordTtsUsage({
      tracking,
      modelName: 'tts-1',
      characters: body.length,
      metadata: { totalContentLength: newsContent.length },
    });

    return Buffer.from(await response.arrayBuffer());
  }

  private extractNewsBody(content: string): string {
    const markerMatch = String(content || '').match(/\bDifficult\s+words\s*:/i);
    if (!markerMatch || typeof markerMatch.index !== 'number') {
      return content.trim();
    }
    return content.slice(0, markerMatch.index).trim();
  }

  private normalizeFeedbackText(text: string | undefined) {
    if (!text) {
      return '';
    }

    const repairedText = this.repairCommonMojibake(text);

    return repairedText
      .replace(/\u00A0/g, ' ')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[–—]/g, '-')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .normalize('NFC')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private repairCommonMojibake(text: string) {
    if (!/[ÃÂÔ├]/.test(text)) {
      return text;
    }

    try {
      return Buffer.from(text, 'latin1').toString('utf8');
    } catch {
      return text;
    }
  }

  async generateQuickTip(input: { teacherId: string; model?: string }) {
    const model = input.model || 'gpt-4o-mini';

    const prompt = `Você é um professor de inglês criando uma "Quick Tip" para alunos brasileiros no WhatsApp.

Gere uma dica rápida de inglês seguindo EXATAMENTE este formato:

🇺🇸 News in English – Quick Tip

📰 <TÍTULO DA DICA>

<EXPLICAÇÃO EM PORTUGUÊS COM EXEMPLOS EM INGLÊS>

✅ <FRASE CORRETA EM INGLÊS>
(<TRADUÇÃO>)

❌ <FRASE INCORRETA EM INGLÊS>
(<TRADUÇÃO>)

💡 <DICA FINAL EM PORTUGUÊS>

Challenge: Complete a frase:
👉 <FRASE PARA COMPLETAR EM INGLÊS>

Regras:
- Escolha um tópico diferente a cada dica (gramática, vocabulário, pronúncia, expressões, falsos cognatos, etc.)
- A dica deve ser curta, didática e útil para alunos brasileiros
- Use emojis moderadamente
- NÃO use placeholders como {{variavel}}
- NÃO inclua JSON

Retorne APENAS o texto da dica, sem formatação adicional.`;

    const response = await this.openai.chat.completions.create({
      model,
      temperature: 0.8,
      messages: [{ role: 'system', content: prompt }],
    });

    await this.usageCostService.recordChatCompletion({
      action: CostAction.QUICK_TIP_GENERATION,
      modelName: model,
      response,
      tracking: {
        referenceType: 'quick_tip_generation',
        referenceId: input.teacherId,
      },
      metadata: { kind: 'quick_tip' },
    });

    return response.choices[0]?.message?.content?.trim() || null;
  }

  async generateContentFromTrend(input: {
    teacherId: string;
    topic: string;
    type: 'VOCABULARY' | 'TIPS' | 'QUIZ' | 'INFORMATIVE' | 'CURIOSITY';
    tone?: string;
    level?: string;
    platform?: string;
    model?: string;
  }) {
    const model = input.model || 'gpt-4o-mini';

    const toneLabels: Record<string, string> = {
      formal: 'formal e profissional',
      informal: 'informal e amigável',
      motivational: 'motivacional e inspirador',
      fun: 'divertido e descontraído',
    };

    const levelLabels: Record<string, string> = {
      beginner: 'iniciante (A1-A2)',
      intermediate: 'intermediário (B1-B2)',
      advanced: 'avançado (C1-C2)',
    };

    const platformLabels: Record<string, string> = {
      whatsapp: 'WhatsApp',
      instagram: 'Instagram',
      facebook: 'Facebook',
      linkedin: 'LinkedIn',
    };

    const typeNames: Record<string, string> = {
      VOCABULARY: 'Vocabulário Temático',
      TIPS: 'Dicas de Inglês',
      QUIZ: 'Quiz Interativo',
      INFORMATIVE: 'Post Informativo',
      CURIOSITY: 'Curiosidade Cultural/Linguística',
    };

    const tone = toneLabels[input.tone || ''] || 'informal e amigável';
    const level = levelLabels[input.level || ''] || 'iniciante (A1-A2)';
    const platform = platformLabels[input.platform || ''] || 'WhatsApp';
    const typeName = typeNames[input.type] || input.type;

    const systemPrompt = `Você é um professor de inglês especializado em criar conteúdo educativo para alunos brasileiros.

REGRAS FUNDAMENTAIS (ACIMA DE TUDO):
- TODO conteúdo deve ensinar inglês de forma explícita — não basta falar SOBRE o tópico.
- Cada post DEVE conter vocabulário útil com tradução, exemplos em inglês com explicação em português, e algo que o aluno aprenda.
- O aluno brasileiro precisa aprender palavras novas, gramática ou expressões em CADA conteúdo gerado.
- Mesmo em posts informativos ou curiosidades, SEMPRE inclua seção de aprendizado de inglês.

Você deve gerar conteúdo no formato JSON, sem markdown, sem comentários, APENAS o JSON válido.

## Contexto
- Tópico: "${input.topic}"
- Tipo de conteúdo: ${typeName}
- Tom: ${tone}
- Nível de inglês: ${level}
- Plataforma alvo: ${platform}

## Instruções para cada tipo

### VOCABULARY (Vocabulário Temático)
Crie um post ENSINANDO vocabulário relacionado ao tópico.
- singlePost: Texto completo explicando 5-8 palavras-chave em inglês, cada uma com definição simples, exemplo em frase, e tradução para português.
- carousel: 4 slides, cada slide = 1 palavra com: título da palavra, body com definição em inglês simples + exemplo + tradução, vocabulary = a palavra em inglês.
- description: Chamada curta para legenda (1-2 frases).

### TIPS (Dicas de Inglês)
Crie dicas práticas de gramática/vocabulário RELACIONADAS ao tópico, ENSINANDO inglês de verdade.
- singlePost: Texto completo com 3-4 dicas de inglês, cada uma com explicação em português, exemplos em inglês com tradução, e regra gramatical clara.
- carousel: 4 slides, cada slide = 1 dica com: título (ex: "Dica 1: ..."), body com explicação + exemplo, vocabulary = palavra-chave.
- description: Chamada curta.

### QUIZ (Quiz Interativo)
Crie um quiz de múltipla escolha para TESTAR e ENSINAR inglês sobre o tópico.
- singlePost: Introdução ao quiz + mini lição de vocabulário útil sobre o tema (5 palavras com tradução).
- carousel: [] (array vazio).
- description: Chamada para participar do quiz.
- quizQuestions: 4 perguntas, cada uma com 3-4 opções, a resposta correta indicada pela letra. As perguntas devem testar vocabulário e compreensão do tema.

### INFORMATIVE (Post Informativo)
Crie um post informativo sobre o tema, mas COM FOCO EM ENSINAR INGLÊS.
- singlePost: Texto informativo em português COM vocabulário destacado. A cada parágrafo, inclua um "📚 Vocabulário:" com 2-3 palavras em inglês, tradução e exemplo.
- carousel: 4 slides com: título do slide, body com informação + "💡 English: [palavra] = [tradução], exemplo: [frase]".
- description: Resumo curto.

### CURIOSITY (Curiosidade Cultural/Linguística)
Crie uma curiosidade sobre cultura inglesa ou linguística, SEMPRE com aprendizado de inglês.
- singlePost: Texto da curiosidade em português + "🇺🇸 English Learning:" com 5 expressões/vocabulário relacionados, cada um com tradução e exemplo.
- carousel: 4 slides, cada um com: título da curiosidade, body com explicação + "📖 New word: [palavra] = [tradução]", vocabulary = palavra-chave.
- description: Chamada curta.

## Regras importantes
- O nível ${level} deve ser respeitado: vocabulário adequado, frases mais curtas para iniciantes, mais complexas para avançados.
- O tom deve ser ${tone}.
- O conteúdo deve ser otimizado para ${platform}.
- Use emojis moderadamente (2-4 no máximo).
- NÃO use placeholders como {{variavel}}.
- NÃO inclua markdown no JSON.
- Garanta que o conteúdo seja culturalmente relevante para alunos brasileiros.
- SEMPRE gere 4 slides no carrossel (exceto Quiz que é array vazio).

## Formato de resposta (JSON)
{
  "singlePost": "string com o texto completo do post com vocabulário e ensino de inglês",
  "carousel": [
    { "title": "Título do slide", "body": "Conteúdo do slide com explicação em português + exemplo em inglês", "vocabulary": "palavra-chave em inglês" }
  ],
  "description": "string com descrição curta",
  "quizQuestions": [
    { "question": "Pergunta?", "options": ["A) Opção 1", "B) Opção 2", "C) Opção 3"], "correctAnswer": "A" }
  ]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model,
        temperature: 0.8,
        messages: [{ role: 'system', content: systemPrompt }],
        response_format: { type: 'json_object' },
      });

      const raw = response.choices[0]?.message?.content?.trim() || '{}';
      const parsed = JSON.parse(raw);

      await this.usageCostService.recordChatCompletion({
        action: CostAction.CONTENT_GENERATION,
        modelName: model,
        response,
        tracking: {
          teacherId: input.teacherId,
          referenceType: 'content_generation',
          referenceId: input.topic,
        },
        metadata: {
          kind: 'content_generation',
          topic: input.topic,
          type: input.type,
          tone: input.tone,
          level: input.level,
          platform: input.platform,
        },
      });

      return {
        singlePost: parsed.singlePost || '',
        carousel: Array.isArray(parsed.carousel) ? parsed.carousel : [],
        description: parsed.description || '',
        quizQuestions: Array.isArray(parsed.quizQuestions)
          ? parsed.quizQuestions
          : [],
        promptUsed: systemPrompt,
        aiModel: model,
      };
    } catch (error) {
      this.logger.error(
        `Erro ao gerar conteúdo para "${input.topic}": ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async generateTopicSuggestions(input: {
    teacherId: string;
    count: number;
    category?: string;
    model?: string;
  }): Promise<string[]> {
    const model = input.model || 'gpt-4o-mini';

    const categoryContext =
      input.category && input.category !== 'all'
        ? `Foco específico em tópicos da categoria "${input.category}". Gere apenas ideias relacionadas a essa área.\n`
        : '';

    const prompt = `Você é um professor de inglês brasileiro especializado em criar conteúdo relevante para alunos brasileiros.

Gere uma lista de ${input.count} tópicos interessantes e atuais que poderiam ser usados para criar conteúdo educativo de inglês.

${categoryContext}Os tópicos devem:
- Ser relevantes para alunos brasileiros de inglês
- Incluir temas que gerem vocabulário útil, dicas gramaticais, quizzes ou conversação
- Ser específicos o suficiente para um post de redes sociais
- Misturar temas do dia-a-dia com temas mais amplos

Retorne APENAS um objeto JSON com uma chave "topics" contendo um array de strings, sem formatação adicional, sem markdown.
Exemplo: {"topics": ["Como pedir comida em um restaurante nos EUA", "Vocabulário de tecnologia para o trabalho", "Diferença entre Make e Do"]}`;

    try {
      const response = await this.openai.chat.completions.create({
        model,
        temperature: 0.9,
        messages: [{ role: 'system', content: prompt }],
        response_format: { type: 'json_object' },
      });

      const raw = response.choices[0]?.message?.content?.trim() || '{}';
      const parsed = JSON.parse(raw);

      const topics: string[] = (
        parsed.topics ||
        parsed.topicos ||
        parsed.suggestions ||
        Object.values(parsed).find(Array.isArray) ||
        []
      )
        .slice(0, input.count)
        .map(String);

      await this.usageCostService.recordChatCompletion({
        action: CostAction.CONTENT_GENERATION,
        modelName: model,
        response,
        tracking: {
          teacherId: input.teacherId,
          referenceType: 'ai_topic_suggestion',
          referenceId: `topics_${Date.now()}`,
        },
        metadata: { kind: 'topic_suggestion', count: input.count },
      });

      return topics.length > 0 ? topics : this.fallbackTopics(input.count);
    } catch (error) {
      this.logger.error(
        `Erro ao gerar sugestões de tópicos: ${error instanceof Error ? error.message : String(error)}`,
      );
      return this.fallbackTopics(input.count);
    }
  }

  private fallbackTopics(count: number): string[] {
    return [
      'Como pedir comida em um restaurante',
      'Vocabulário de tecnologia para o trabalho',
      'Diferença entre Make e Do',
      'Expressões idiomáticas com cores',
      'Como escrever um e-mail profissional em inglês',
      'Falsos cognatos mais comuns',
      'Vocabulário para viagens internacionais',
      'Phrasal verbs com "get"',
      'Como falar sobre suas férias em inglês',
      'Diferença entre Say, Tell, Speak e Talk',
      'Vocabulário de roupas e compras',
      'Como agendar uma consulta médica em inglês',
    ].slice(0, count);
  }
}
