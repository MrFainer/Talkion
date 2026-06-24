import { Module } from '@nestjs/common';
import { TrendsService } from './trends.service';
import { TrendsController } from './trends.controller';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  providers: [TrendsService],
  controllers: [TrendsController],
  exports: [TrendsService],
})
export class TrendsModule {}
