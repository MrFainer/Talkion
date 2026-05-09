import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class QuizService {
  private readonly logger = new Logger(QuizService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  /**
   * Gera um quiz para uma notícia recém-cadastrada que ainda não tenha quiz.
   */
  async generateQuizForNews(newsId: string) {
    try {
      const news = await this.prisma.news.findUnique({
        where: { id: newsId },
      });

      if (!news) {
        throw new Error('Notícia não encontrada');
      }

      // Verifica se já existe um quiz para essa notícia
      const existingQuiz = await this.prisma.quiz.findFirst({
        where: { news_id: news.id },
      });

      if (existingQuiz) {
        this.logger.log(`Quiz já existe para a notícia ${newsId}`);
        return existingQuiz;
      }

      this.logger.log(`Gerando novo quiz para a notícia ${newsId}...`);
      
      const questions = await this.aiService.generateQuiz(news.content);

      if (!questions || questions.length === 0) {
        throw new Error('A IA não gerou perguntas válidas.');
      }

      const newQuiz = await this.prisma.quiz.create({
        data: {
          news_id: news.id,
          questions: questions, // Prisma vai serializar como JSON automaticamente
        },
      });

      this.logger.log(`Quiz criado com sucesso para a notícia ${newsId}`);
      return newQuiz;

    } catch (error) {
      this.logger.error(`Erro ao gerar quiz para notícia ${newsId}`, error);
      throw error;
    }
  }

  /**
   * Submete a resposta do aluno a uma pergunta e valida se está correta.
   */
  async submitAnswer(studentId: string, quizId: string, questionId: string, selectedAnswer: string) {
    try {
      const quiz = await this.prisma.quiz.findUnique({
        where: { id: quizId },
      });

      if (!quiz) throw new Error('Quiz não encontrado');

      // Busca a pergunta específica dentro do JSON (supondo que "questions" é um array)
      const questionsArray = quiz.questions as any[];
      // Assumindo que a IA pode não retornar um ID único, usaremos a própria string da pergunta ou um índice.
      // O ideal é a IA gerar IDs ou usarmos o índice do array.
      // Neste mock, consideramos que questionId é a própria string da pergunta ou o índice convertido para string
      
      let isCorrect = false;
      const questionIndex = parseInt(questionId, 10);
      
      if (!isNaN(questionIndex) && questionsArray[questionIndex]) {
         const questionObj = questionsArray[questionIndex];
         isCorrect = questionObj.correct_answer === selectedAnswer;
      }

      const answerRecord = await this.prisma.quizAnswer.create({
        data: {
          student_id: studentId,
          quiz_id: quizId,
          question_id: questionId,
          selected_answer: selectedAnswer,
          is_correct: isCorrect,
        },
      });

      return {
        success: true,
        isCorrect,
        record: answerRecord,
      };
    } catch (error) {
      this.logger.error('Erro ao submeter resposta', error);
      throw error;
    }
  }
}
