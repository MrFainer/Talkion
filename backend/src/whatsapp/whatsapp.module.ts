import { Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { QuizModule } from '../quiz/quiz.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [QuizModule, AiModule],
  providers: [WhatsappService],
  controllers: [WhatsappController],
  exports: [WhatsappService]
})
export class WhatsappModule {}
