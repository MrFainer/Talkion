import { Injectable, Logger } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OpenAI } from 'openai';

type SpeakingEvaluationResult = {
  score: number;
  feedback: string;
  mistakes: string[];
  strengths: string[];
  improvements: string[];
  tips: string[];
  transcription: string;
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private openai: OpenAI;

  constructor() {
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
  ): Promise<{ title: string; content: string }> {
    this.logger.log(`Gerando notícia via IA para o nível: ${level}`);

    const prompt = `Você é um criador de conteúdo educacional para estudantes de inglês.

Gere uma notícia curta em inglês:

Regras:
- Nível: ${level} (LEVEL_1 = básico, LEVEL_2 = intermediário, LEVEL_3 = avançado)
- Tema atual e interessante
- Linguagem natural
- Fácil compreensão
- Aproximadamente 250 palavras
- Formato de saída: JSON com as chaves "title" e "content"`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: prompt }],
        response_format: { type: 'json_object' },
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

  /**
   * Gera um quiz baseado no conteúdo da notícia.
   */
  async generateQuiz(newsText: string): Promise<any[]> {
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

  /**
   * Avalia o áudio do aluno (Speaking) transcrevendo com Whisper e avaliando com GPT.
   */
  async evaluateSpeaking(
    originalText: string,
    audioBase64: string,
    mimeType?: string,
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

      const transcriptionResponse = await this.openai.audio.transcriptions.create({
        file: createReadStream(tempFilePath),
        model: 'whisper-1',
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
