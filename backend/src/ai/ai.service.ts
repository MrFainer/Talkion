import { Injectable, Logger } from '@nestjs/common';
import { OpenAI } from 'openai';

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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _audioFilePath: string,
  ): Promise<any> {
    // 1. Transcrever com Whisper
    // Nota: Em um cenário real, você passaria o buffer do áudio ou um File stream para o Whisper
    // const transcriptionResponse = await this.openai.audio.transcriptions.create({
    //   file: fs.createReadStream(audioFilePath),
    //   model: 'whisper-1',
    // });
    // const studentTranscription = transcriptionResponse.text;

    // Para fins de mock/desenvolvimento:
    const studentTranscription = 'Mocked transcription for testing.';

    // 2. Avaliar transcrição comparando com original
    const prompt = `Você é um professor de inglês especializado em speaking.

Compare:
Texto original:
${originalText}

Transcrição do aluno:
${studentTranscription}

Gere:
- Nota de 0 a 10 (score)
- Feedback amigável (feedback)
- Principais erros em um array (mistakes)

Formato de saída: JSON contendo "score", "feedback" e "mistakes" (array de strings).`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: prompt }],
        response_format: { type: 'json_object' },
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error) {
      this.logger.error('Erro ao avaliar speaking via IA', error);
      throw error;
    }
  }
}
