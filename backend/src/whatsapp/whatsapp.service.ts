import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma.service';
import { QuizService } from '../quiz/quiz.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly evolutionApiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
  private readonly apiKey = process.env.EVOLUTION_API_KEY || 'global_api_key_talkion';
  private readonly instanceName = 'talkion_main';

  constructor(
    private readonly prisma: PrismaService,
    private readonly quizService: QuizService,
    private readonly aiService: AiService,
  ) {}

  /**
   * Envia uma mensagem de texto (Notícia, Quiz, etc) para um grupo ou pessoa
   */
  async sendMessage(numberOrGroupId: string, text: string) {
    try {
      const url = `${this.evolutionApiUrl}/message/sendText/${this.instanceName}`;
      
      await axios.post(
        url,
        {
          number: numberOrGroupId,
          text: text,
        },
        {
          headers: {
            apikey: this.apiKey,
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(`Mensagem enviada com sucesso para ${numberOrGroupId}`);
    } catch (error) {
      this.logger.error(`Erro ao enviar mensagem para ${numberOrGroupId}`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Processa o Webhook recebido da Evolution API
   */
  async handleWebhook(payload: any) {
    this.logger.log(`Webhook recebido: ${payload.event}`);

    // Exemplo de payload esperado da Evolution API:
    // { event: 'messages.upsert', data: { message: { ... }, key: { remoteJid: '...', fromMe: false } } }

    if (payload.event === 'messages.upsert') {
      const messageData = payload.data?.message;
      const remoteJid = payload.data?.key?.remoteJid;
      const fromMe = payload.data?.key?.fromMe;

      if (fromMe || !messageData) return; // Ignora mensagens enviadas pelo próprio bot

      const isGroup = remoteJid.includes('@g.us');
      const textContent = messageData.conversation || messageData.extendedTextMessage?.text;
      const audioMessage = messageData.audioMessage;

      // O número do aluno pode ser extraído do participant (se grupo) ou do remoteJid (se privado)
      const senderJid = isGroup ? payload.data?.key?.participant : remoteJid;
      if (!senderJid) return;
      
      const whatsappNumber = senderJid.split('@')[0];

      // Busca o aluno no banco de dados
      let student = await this.prisma.student.findUnique({
        where: { whatsapp_number: whatsappNumber },
      });

      // Se o aluno não existir, poderíamos criar automaticamente ou ignorar
      if (!student) {
        this.logger.warn(`Aluno não encontrado para o número: ${whatsappNumber}`);
        return;
      }

      // Salva a mensagem bruta recebida
      await this.saveMessageToDb(student.id, isGroup, textContent, audioMessage ? 'AUDIO_URL_PLACEHOLDER' : null);

      if (audioMessage) {
        this.logger.log(`Áudio recebido de ${whatsappNumber}, processando Speaking...`);
        await this.handleAudioMessage(student.id, remoteJid, payload.data);
      } else if (textContent) {
        this.logger.log(`Texto recebido de ${whatsappNumber}: ${textContent}`);
        await this.handleTextMessage(student.id, remoteJid, textContent);
      }
    }
  }

  private async handleTextMessage(studentId: string, remoteJid: string, text: string) {
    // Lógica para verificar se o texto é uma resposta de quiz (ex: "A", "B", "1A")
    // Como simplificação, vamos pegar o último quiz ativo (ou a última notícia com quiz)
    
    // Expressão regular simples para pegar algo como "1A", "1 - A", "A", etc.
    // Vamos assumir que a resposta tem 1 a 3 caracteres se for uma alternativa.
    const cleanText = text.trim().toUpperCase();
    
    if (cleanText.length <= 3 && /^[A-D]$/.test(cleanText.slice(-1))) {
      // Parece ser uma resposta. Ex: "A", "1A", "1-A"
      const letter = cleanText.slice(-1); // Pega a última letra (A, B, C, D)
      
      // Busca o quiz mais recente
      const latestQuiz = await this.prisma.quiz.findFirst({
        orderBy: { created_at: 'desc' },
      });

      if (latestQuiz) {
        // Encontra uma pergunta que o aluno ainda não respondeu, ou apenas salva
        // No cenário real, teríamos a identificação de qual pergunta ele está respondendo.
        // Como o quiz tem 3 perguntas, e ele mandou apenas a letra, vamos considerar a primeira não respondida.
        
        const alreadyAnswered = await this.prisma.quizAnswer.findMany({
          where: { student_id: studentId, quiz_id: latestQuiz.id }
        });

        const questionsArray = latestQuiz.questions as any[];
        const nextQuestionIndex = alreadyAnswered.length;

        if (nextQuestionIndex < questionsArray.length) {
          const questionObj = questionsArray[nextQuestionIndex];
          const isCorrect = questionObj.correct_answer.startsWith(letter);

          await this.prisma.quizAnswer.create({
            data: {
              student_id: studentId,
              quiz_id: latestQuiz.id,
              question_id: nextQuestionIndex.toString(),
              selected_answer: letter,
              is_correct: isCorrect,
            },
          });

          const replyText = isCorrect 
            ? `✅ Correto! Você acertou a pergunta ${nextQuestionIndex + 1}.` 
            : `❌ Incorreto. A resposta correta era: ${questionObj.correct_answer}`;
          
          await this.sendMessage(remoteJid, replyText);
        } else {
          await this.sendMessage(remoteJid, `Você já respondeu todas as perguntas do quiz atual!`);
        }
      }
    }
  }

  private async handleAudioMessage(studentId: string, remoteJid: string, messageData: any) {
    // 1. Obter a base64 do áudio chamando a rota da Evolution API
    // GET /chat/getBase64FromMediaMessage
    try {
      // Como o base64 = false no webhook, precisamos baixar a mídia
      const mediaResponse = await axios.post(
        `${this.evolutionApiUrl}/chat/getBase64FromMediaMessage/${this.instanceName}`,
        { message: messageData },
        { headers: { apikey: this.apiKey, 'Content-Type': 'application/json' } }
      );

      const base64Audio = mediaResponse.data?.base64;
      if (!base64Audio) throw new Error('Não foi possível obter o áudio');

      // 2. Busca a notícia mais recente (mock para "originalText")
      const latestNews = await this.prisma.news.findFirst({
        orderBy: { created_at: 'desc' },
      });

      if (!latestNews) {
        await this.sendMessage(remoteJid, "Nenhuma notícia encontrada para avaliar o áudio.");
        return;
      }

      // 3. Avalia o speaking usando a IA
      // Nota: o aiService atual precisa receber o arquivo ou buffer.
      // O mock atual não lê de fato o arquivo, mas já passamos o fluxo.
      const feedback = await this.aiService.evaluateSpeaking(latestNews.content, 'mocked_audio_path');

      // 4. Salva a submissão e o feedback
      const submission = await this.prisma.audioSubmission.create({
        data: {
          student_id: studentId,
          news_id: latestNews.id,
          audio_url: 'base64_audio_saved_or_url',
          transcription: 'transcription_mock',
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

      // 5. Envia o feedback pro aluno
      const replyText = `🎤 *Feedback de Speaking*\n\nNota: ${feedback.score}/10\n\n${feedback.feedback}\n\nPrincipais erros: ${feedback.mistakes?.join(', ') || 'Nenhum'}`;
      await this.sendMessage(remoteJid, replyText);

    } catch (error) {
      this.logger.error('Erro ao processar áudio', error);
      await this.sendMessage(remoteJid, "Desculpe, ocorreu um erro ao avaliar o seu áudio.");
    }
  }

  private async saveMessageToDb(studentId: string, isGroup: boolean, content: string, mediaUrl: string | null) {
    try {
      await this.prisma.whatsappMessage.create({
        data: {
          student_id: studentId,
          message_type: isGroup ? 'GROUP' : 'PRIVATE',
          direction: 'INCOMING',
          content: content || '[Mídia recebida]',
          media_url: mediaUrl,
        }
      });
    } catch (error) {
      this.logger.error('Erro ao salvar mensagem no banco de dados', error);
    }
  }
}
