import { Module } from '@nestjs/common';
import { NewsService } from './news.service';
import { NewsController } from './news.controller';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  providers: [NewsService],
  controllers: [NewsController],
  exports: [NewsService]
})
export class NewsModule {}
