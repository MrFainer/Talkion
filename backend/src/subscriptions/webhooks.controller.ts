import { Controller, Post, Body, Headers, Logger } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { PrismaService } from '../prisma.service';
import * as crypto from 'crypto';

function validateMercadoPagoSignature(
  body: any,
  xSignature: string | undefined,
  secret: string,
): boolean {
  if (!xSignature || !secret) return false;

  const parts = xSignature.split(',');
  let ts = '';
  let hash = '';

  for (const part of parts) {
    const [key, value] = part.trim().split('=');
    if (key === 'ts') ts = value;
    if (key === 'v1') hash = value;
  }

  if (!ts || !hash) return false;

  const dataId = body?.data?.id || body?.id || '';
  const manifest = `${ts}.${dataId}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(manifest)
    .digest('hex');

  return hash === expected;
}

@Controller('webhooks/mercadopago')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly service: SubscriptionsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  async handleWebhook(
    @Body() body: any,
    @Headers('x-signature') signature?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;

    if (
      signature &&
      secret &&
      !validateMercadoPagoSignature(body, signature, secret)
    ) {
      this.logger.warn(
        `Invalid webhook signature (requestId: ${requestId || 'N/A'}) - processing anyway`,
      );
    }

    this.logger.log(`Webhook received: ${JSON.stringify(body).slice(0, 500)}`);

    try {
      const topic = body?.topic || body?.type || body?.action;

      if (topic === 'payment' || topic?.includes('payment')) {
        await this.handlePaymentEvent(body);
      } else if (topic === 'preapproval' || topic?.includes('preapproval')) {
        await this.handlePreapprovalEvent(body);
      } else if (body?.resource?.includes('/preapproval/')) {
        await this.handlePreapprovalById(body.resource);
      }

      return { received: true };
    } catch (err) {
      this.logger.error(`Webhook error: ${(err as Error).message}`);
      return { received: true };
    }
  }

  private async handlePaymentEvent(body: any) {
    const data = body.data || body;
    const mpPaymentId = String(data.id || body.id || '');
    if (!mpPaymentId) return;

    const status = data.status || body.status;
    const amount = parseFloat(
      data.transaction_amount || data.amount || body.transaction_amount || '0',
    );
    const paidAt =
      data.date_approved || body.date_approved || new Date().toISOString();
    const paymentMethod =
      data.payment_method_id || body.payment_method_id || 'credit_card';
    const externalRef = data.external_reference || body.external_reference;

    if (externalRef && externalRef.startsWith('topup:')) {
      const parts = externalRef.split(':');
      const userId = parts[1];
      const packId = parts.slice(2).join(':');
      if (status === 'approved') {
        await this.service.handleTopUpApproved(mpPaymentId, userId, packId);
      }
      return;
    }

    if (externalRef && externalRef.startsWith('additional:')) {
      const parts = externalRef.split(':');
      const userId = parts[1];
      const subscriptionId = parts[2];
      const quantity = parseInt(parts[3] || '1', 10);
      if (status === 'approved') {
        await this.service.handleAdditionalStudentsApproved(
          mpPaymentId,
          userId,
          subscriptionId,
          quantity,
        );
      }
      return;
    }

    let subscriptionId: string | null = null;

    if (externalRef) {
      const sub = await this.service.getUserSubscription(externalRef);
      if (sub) subscriptionId = sub.id;
    }

    if (!subscriptionId) {
      const payment = await this.prisma.subscriptionPayment.findUnique({
        where: { mercadopago_payment_id: mpPaymentId },
        select: { subscription_id: true },
      });
      if (payment) subscriptionId = payment.subscription_id;
    }

    if (!subscriptionId) {
      this.logger.warn(
        `Could not resolve subscription for payment ${mpPaymentId}`,
      );
      return;
    }

    if (status === 'approved') {
      await this.service.handlePaymentApproved(
        mpPaymentId,
        subscriptionId,
        amount,
        paidAt,
        paymentMethod,
      );
    } else if (
      ['rejected', 'refunded', 'cancelled', 'charged_back'].includes(status)
    ) {
      await this.service.handlePaymentRejected(
        mpPaymentId,
        subscriptionId,
        amount,
      );
    }
  }

  private async handlePreapprovalEvent(body: any) {
    const data = body.data || body;
    const mpSubscriptionId = String(data.id || body.id || '');
    if (!mpSubscriptionId) return;

    const status = data.status || body.status;

    if (status === 'cancelled') {
      await this.service.handleSubscriptionCancelled(mpSubscriptionId);
    } else if (status === 'paused') {
      await this.service.handleSubscriptionPaused(mpSubscriptionId);
    } else if (status === 'authorized' || status === 'pending') {
      const nextBilling = data.next_payment_date || body.next_payment_date;
      await this.service.handleSubscriptionUpdated(mpSubscriptionId, {
        status,
        nextBillingDate: nextBilling,
      });
    }
  }

  private async handlePreapprovalById(resource: string) {
    const parts = resource.split('/');
    const mpSubscriptionId = parts[parts.length - 1];
    if (!mpSubscriptionId) return;
    await this.handlePreapprovalEvent({ id: mpSubscriptionId });
  }
}
