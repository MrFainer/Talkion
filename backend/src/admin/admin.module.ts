import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { CreditsModule } from '../credits/credits.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [CreditsModule, SubscriptionsModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
