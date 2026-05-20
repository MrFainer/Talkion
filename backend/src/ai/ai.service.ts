import { Injectable, Logger } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CostAction } from '@prisma/client';
import { parseBuffer, parseFile } from 'music-metadata';
import { OpenAI } from 'openai';
import { UsageCostService, type UsageTrackingContext } from './usage-cost.service';

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

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private openai: OpenAI;

  constructor(private readonly usageCostService: UsageCostService) {
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
  - no final, uma linha "Difficult words:" com 6 a 10 itens separados por vírgula, no formato: word (meaning)
  - todas as difficult words precisam aparecer no texto e devem estar destacadas com **negrito** (markdown), por exemplo: **economy**
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

      return {
        title: result.title,
        content: result.content,
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
    Record<'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3', { title: string; content: string }>
  > {
    this.logger.log('Gerando notícia via IA (bundle LEVEL_1/2/3 com um único tema)');

    const buildAvoid = (level: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3') => {
      const avoidTitle = String(optionsByLevel?.[level]?.avoidTitle || '').trim();
      const avoidContent = String(optionsByLevel?.[level]?.avoidContent || '').trim();
      if (!avoidTitle && !avoidContent) return '';
      const contentPreview = avoidContent ? `${avoidContent.slice(0, 500)}...` : '(vazio)';
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
  - no final, uma linha "Difficult words:" com 6 a 10 itens separados por vírgula, no formato: word (meaning)
  - todas as difficult words precisam aparecer no texto e devem estar destacadas com **negrito** (markdown), por exemplo: **economy**
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

    const parsed = JSON.parse(response.choices[0].message.content || '{}') as any;
    const level1 = parsed?.LEVEL_1;
    const level2 = parsed?.LEVEL_2;
    const level3 = parsed?.LEVEL_3;
    const isValidItem = (item: any) =>
      item && typeof item.title === 'string' && typeof item.content === 'string' && item.title.trim() && item.content.trim();

    if (!isValidItem(level1) || !isValidItem(level2) || !isValidItem(level3)) {
      throw new Error('A IA não retornou o formato esperado para o bundle de notícias.');
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

  async generateWhatsappOutboundMessages(
    input: WhatsappOutboundGenerationInput,
  ): Promise<WhatsappOutboundMessage[]> {
    const model = input.model || 'gpt-4o-mini';
    const temperature =
      typeof input.temperature === 'number' && Number.isFinite(input.temperature)
        ? input.temperature
        : 0.7;

    const greetingIdea = String(input.ideas?.greetingIdea || '').trim();
    const previousQuizHeaderIdea = String(input.ideas?.previousQuizHeaderIdea || '').trim();
    const challengeIdea = String(input.ideas?.challengeIdea || '').trim();
    const quizFooterIdea = String(input.ideas?.quizFooterIdea || '').trim();
    const newsIntroIdea = String(input.ideas?.newsIntroIdea || '').trim();
    const defaultIdea =
      'Crie mensagens curtas, claras e motivacionais no estilo WhatsApp. Use inglês como idioma principal e, quando fizer sentido, inclua uma linha em português brasileiro para ajudar alunos. Evite textos longos.';
    const hasAnyIdea = Boolean(
      greetingIdea || previousQuizHeaderIdea || challengeIdea || quizFooterIdea || newsIntroIdea,
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

    const systemPrompt = `${input.systemPrompt || 'Você é um professor de inglês e assistente do Talkion.'}

Tarefa:
- Gerar as mensagens que serão enviadas no WhatsApp.
- Modo: ${input.mode}

Importante:
- Use as templates fornecidas como referência forte de tom e estrutura.
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
        referenceType: input.tracking?.referenceType || 'whatsapp_message_generation',
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

    return parsed.messages
      .filter((m: any) => m && typeof m === 'object')
      .map((m: any) => ({
        kind: m.kind,
        text: String(m.text || '').trim(),
      }))
      .filter((m: any) => allowedKinds.has(m.kind) && m.text.length > 0);
  }

  async generatePrivateBroadcastMessages(
    input: PrivateBroadcastGenerationInput,
  ): Promise<PrivateBroadcastMessageItem[]> {
    const model = input.model || 'gpt-4o-mini';
    const temperature =
      typeof input.temperature === 'number' && Number.isFinite(input.temperature)
        ? input.temperature
        : 0.7;

    const keys = input.alunos.map((a) => ({ nome: a.nome, whatsapp: a.whatsapp }));

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
          input.tracking?.referenceType || 'whatsapp_private_broadcast_generation',
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
      .filter((item: any) => item.nome && item.whatsapp && item.mensagens.length > 0);
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

      const transcriptionResponse = await this.openai.audio.transcriptions.create({
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

      const parsed = JSON.parse(response.choices[0].message.content || '{}') as {
        score?: number;
        feedback?: string;
        mistakes?: string[];
        strengths?: string[];
        improvements?: string[];
        tips?: string[];
      };

      return {
        score:
          typeof parsed.score === 'number' && Number.isFinite(parsed.score)
            ? parsed.score
            : 0,
        feedback: this.normalizeFeedbackText(parsed.feedback) || 'Sem feedback.',
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
    const dataUriMatch = trimmedAudio.match(/^data:(audio\/[-+\w.]+);base64,(.+)$/i);
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

      if (typeof durationSeconds === 'number' && Number.isFinite(durationSeconds)) {
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

      if (typeof durationSeconds === 'number' && Number.isFinite(durationSeconds)) {
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

    if (normalizedMimeType.includes('mpeg') || normalizedMimeType.includes('mp3')) {
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
}
