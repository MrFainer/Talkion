import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { MercadoPagoService } from './mercadopago.service';
import { WebhooksController } from './webhooks.controller';
import { MailService } from '../auth/mail.service';
import { CreditsService } from '../credits/credits.service';

@Module({
  controllers: [SubscriptionsController, WebhooksController],
  providers: [SubscriptionsService, MercadoPagoService, MailService, CreditsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
