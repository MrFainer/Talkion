import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { NewsService } from './news.service';

@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Post('test-scraper')
  @HttpCode(HttpStatus.OK)
  async testScraper() {
    await this.newsService.scrapeLatestNews();
    return { message: 'Scraping executado com sucesso!' };
  }
}
