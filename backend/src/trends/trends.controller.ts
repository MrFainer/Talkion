import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TrendsService } from './trends.service';

@Controller('trends')
export class TrendsController {
  constructor(private readonly trendsService: TrendsService) {}

  @Get('trending')
  getTrending(@Query('area') area?: string, @Query('geo') geo?: string) {
    return this.trendsService.getTrending(area, geo);
  }

  @Post('ai-topics')
  @HttpCode(HttpStatus.OK)
  generateAiTopics(
    @Body() body: { teacherId: string; count?: number; category?: string },
  ) {
    return this.trendsService.generateAiTopics(
      body.teacherId,
      body.count || 12,
      body.category,
    );
  }

  @Get('categories')
  getCategories() {
    return this.trendsService.getCategories();
  }

  @Get('geo-options')
  getGeoOptions() {
    return this.trendsService.getGeoOptions();
  }
}
