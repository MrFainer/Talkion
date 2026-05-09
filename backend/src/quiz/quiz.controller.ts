import { Controller, Post, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { QuizService } from './quiz.service';

@Controller('quiz')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  // Rota temporária para forçar a geração de um quiz para uma notícia
  @Post('test-generate/:newsId')
  @HttpCode(HttpStatus.OK)
  async testGenerateQuiz(@Param('newsId') newsId: string) {
    const quiz = await this.quizService.generateQuizForNews(newsId);
    return { message: 'Quiz gerado!', quiz };
  }
}
