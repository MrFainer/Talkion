import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { UsageCostService } from './usage-cost.service';

@Module({
  providers: [AiService, UsageCostService],
  controllers: [AiController],
  exports: [AiService, UsageCostService],
})
export class AiModule {}
