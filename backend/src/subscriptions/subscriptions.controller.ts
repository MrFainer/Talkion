import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { MercadoPagoService } from './mercadopago.service';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly service: SubscriptionsService,
    private readonly mpService: MercadoPagoService,
  ) {}

  // ─── Planos ────────────────────────────────────────────────────────

  @Get('plans')
  async listPlans() {
    return this.service.listPlans();
  }

  @Post('plans')
  async createPlan(
    @Body()
    body: {
      name: string;
      description?: string;
      price: number;
      credits: number;
    },
  ) {
    if (!body.name || body.price == null || body.credits == null) {
      throw new BadRequestException('name, price e credits são obrigatórios');
    }
    return this.service.createPlan(body);
  }

  @Patch('plans/:id')
  async updatePlan(@Param('id') id: string, @Body() body: any) {
    return this.service.updatePlan(id, body);
  }

  @Delete('plans/:id')
  async deletePlan(@Param('id') id: string) {
    return this.service.deletePlan(id);
  }

  // ─── Assinatura do usuário ─────────────────────────────────────────

  @Get('user/:userId')
  async getUserSubscription(@Param('userId') userId: string) {
    const sub = await this.service.getUserSubscription(userId);
    return sub || null;
  }

  @Post('user/:userId')
  async createSubscription(
    @Param('userId') userId: string,
    @Body() body: { planId: string; cardToken: string },
  ) {
    if (!body.planId || !body.cardToken) {
      throw new BadRequestException('planId e cardToken são obrigatórios');
    }
    return this.service.createSubscription(userId, body);
  }

  @Post('user/:userId/cancel')
  async cancelSubscription(@Param('userId') userId: string) {
    return this.service.cancelSubscription(userId);
  }

  @Patch('user/:userId/plan')
  async changePlan(
    @Param('userId') userId: string,
    @Body() body: { planId: string },
  ) {
    if (!body.planId) throw new BadRequestException('planId é obrigatório');
    return this.service.changePlan(userId, body.planId);
  }

  @Get('user/:userId/payments')
  async getPaymentHistory(@Param('userId') userId: string) {
    return this.service.getPaymentHistory(userId);
  }

  // ─── Credit Top-Ups ─────────────────────────────────────────────────

  @Get('topup-plans')
  async getTopUpPlans() {
    return this.service.getTopUpPlans();
  }

  @Post('user/:userId/topup')
  async purchaseTopUp(
    @Param('userId') userId: string,
    @Body() body: { packId: string; cardToken: string },
  ) {
    if (!body.packId || !body.cardToken) {
      throw new BadRequestException('packId e cardToken são obrigatórios');
    }
    return this.service.purchaseTopUp(userId, body);
  }

  @Post('user/:userId/additional-students')
  async purchaseAdditionalStudents(
    @Param('userId') userId: string,
    @Body() body: { quantity: number; cardToken: string },
  ) {
    if (!body.quantity || !body.cardToken) {
      throw new BadRequestException('quantity e cardToken são obrigatórios');
    }
    return this.service.purchaseAdditionalStudents(userId, body);
  }

  @Get('user/:userId/current-students')
  async getCurrentStudents(@Param('userId') userId: string) {
    const count = await this.service.getCurrentStudents(userId);
    return { count };
  }

  @Get('test-mp')
  async testMpConnection() {
    return this.mpService.testConnection();
  }

  @Post('test-preapproval')
  async testPreApproval() {
    return this.mpService.testPreApprovalDirect();
  }

  @Post('user/:userId/direct-pay')
  async directPay(
    @Param('userId') userId: string,
    @Body()
    body: {
      type: 'subscription' | 'topup' | 'additional';
      planId?: string;
      packId?: string;
      quantity?: number;
    },
  ) {
    if (!body.type) {
      throw new BadRequestException('type é obrigatório');
    }

    switch (body.type) {
      case 'subscription':
        if (!body.planId)
          throw new BadRequestException(
            'planId é obrigatório para subscription',
          );
        return this.service.createSubscriptionWithCard(userId, {
          planId: body.planId,
        });

      case 'topup':
        if (!body.packId)
          throw new BadRequestException('packId é obrigatório para topup');
        return this.service.purchaseTopUpWithCard(userId, {
          packId: body.packId,
        });

      case 'additional':
        if (!body.quantity)
          throw new BadRequestException(
            'quantity é obrigatório para additional',
          );
        return this.service.purchaseAdditionalStudentsWithCard(userId, {
          quantity: body.quantity,
        });

      default:
        throw new BadRequestException('Tipo de pagamento inválido');
    }
  }
}
