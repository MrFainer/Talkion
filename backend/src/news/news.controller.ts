import { Controller, Post, HttpCode, HttpStatus, Body } from '@nestjs/common';
import { NewsService } from './news.service';

@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Post('daily-run')
  @HttpCode(HttpStatus.OK)
  async runDaily(@Body() body: { teacherId?: string }) {
    if (body?.teacherId) {
      return this.newsService.runDailyNewsAndQuiz({
        teacherId: body.teacherId,
        referenceType: 'manual_news_run',
        referenceId: new Date().toISOString(),
        metadata: {
          trigger: 'manual',
        },
      });
    }

    return this.newsService.handleDailyNewsScraping();
  }

  @Post('scrape')
  @HttpCode(HttpStatus.OK)
  async scrape(@Body() body: { teacherId?: string }) {
    return this.runDaily(body);
  }
}
