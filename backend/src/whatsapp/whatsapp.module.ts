import { Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { AiModule } from '../ai/ai.module';
import { QuizModule } from '../quiz/quiz.module';
import { NewsModule } from '../news/news.module';

@Module({
  imports: [AiModule, QuizModule, NewsModule],
  providers: [WhatsappService],
  controllers: [WhatsappController],
  exports: [WhatsappService],
})
export class WhatsappModule {}
