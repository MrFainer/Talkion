import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { MercadoPagoService } from './mercadopago.service';
import { MailService } from '../auth/mail.service';
import { CreditsService } from '../credits/credits.service';

const TOP_UP_PLANS = [
  { id: 'topup_5000', name: '5.000 Créditos Extras', price: 29.90, credits: 5000 },
  { id: 'topup_10000', name: '10.000 Créditos Extras', price: 49.90, credits: 10000 },
  { id: 'topup_20000', name: '20.000 Créditos Extras', price: 89.90, credits: 20000 },
];

const ADDITIONAL_STUDENT_PRICE = 2.99;

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mp: MercadoPagoService,
    private readonly mailService: MailService,
    private readonly creditsService: CreditsService,
  ) {}

  async listPlans() {
    return this.prisma.subscriptionPlan.findMany({
      where: { active: true },
      orderBy: { price: 'asc' },
    });
  }

  async createPlan(data: { name: string; description?: string; price: number; credits: number; max_students?: number }) {
    const plan = await this.prisma.subscriptionPlan.create({
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        credits: data.credits,
        max_students: data.max_students ?? 50,
      },
    });
    this.logger.log(`Plan created: ${plan.id} - ${plan.name} (${plan.max_students} alunos)`);
    return plan;
  }

  async getTopUpPlans() {
    return TOP_UP_PLANS;
  }

  async purchaseTopUp(userId: string, dto: { packId: string; cardToken: string }) {
    const pack = TOP_UP_PLANS.find(p => p.id === dto.packId);
    if (!pack) throw new NotFoundException('Pacote de créditos não encontrado');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    try {
      const mpCustomerId = await this.mp.findOrCreateCustomer(user.email, user.name, userId);

      const payment = await this.mp.createOneTimePayment(
        mpCustomerId,
        dto.cardToken,
        pack.price,
        `Talkion - ${pack.name}`,
        userId,
        user.email,
      );

      if (payment.status === 'approved') {
        await this.creditsService.addCredits(
          userId,
          pack.credits,
          `Compra de ${pack.name}`,
          'topup',
          pack.id,
        );
        return { success: true, status: payment.status, credits: pack.credits };
      }

      return { success: false, status: payment.status, paymentId: payment.id };
    } catch (err) {
      this.logger.error(`Top-up failed: ${(err as Error).message}`);
      throw new BadRequestException(`Erro na compra: ${(err as Error).message}`);
    }
  }

  async purchaseAdditionalStudents(userId: string, dto: { quantity: number; cardToken: string }) {
    if (dto.quantity < 1) throw new BadRequestException('Quantidade deve ser >= 1');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const sub = await this.prisma.subscription.findFirst({
      where: { user_id: userId, status: { in: ['active', 'pending'] } },
    });
    if (!sub) throw new NotFoundException('Nenhuma assinatura ativa encontrada');

    const totalPrice = dto.quantity * ADDITIONAL_STUDENT_PRICE;

    try {
      const mpCustomerId = await this.mp.findOrCreateCustomer(user.email, user.name, userId);

      const payment = await this.mp.createOneTimePayment(
        mpCustomerId,
        dto.cardToken,
        totalPrice,
        `Talkion - ${dto.quantity} aluno(s) adicional(is)`,
        userId,
        user.email,
      );

      if (payment.status === 'approved') {
        const newAdditional = sub.additional_students + dto.quantity;
        const updated = await this.prisma.subscription.update({
          where: { id: sub.id },
          data: { additional_students: newAdditional },
        });
        if (sub.mercadopago_subscription_id && sub.plan_id) {
          const planData = await this.prisma.subscriptionPlan.findUnique({ where: { id: sub.plan_id } });
          if (planData) {
            const nextAmount = planData.price + newAdditional * ADDITIONAL_STUDENT_PRICE;
            try {
              await this.mp.updateSubscriptionAmount(sub.mercadopago_subscription_id, nextAmount);
              this.logger.log(`Preapproval ${sub.mercadopago_subscription_id} amount updated to ${nextAmount}`);
            } catch (err) {
              this.logger.warn(`Failed to update preapproval amount: ${(err as Error).message}`);
            }
          }
        }
        this.logger.log(`Additional students added: +${dto.quantity} for user ${userId}`);
        return { success: true, totalStudents: sub.max_students + updated.additional_students };
      }

      return { success: false, status: payment.status, paymentId: payment.id };
    } catch (err) {
      this.logger.error(`Additional students purchase failed: ${(err as Error).message}`);
      throw new BadRequestException(`Erro na compra: ${(err as Error).message}`);
    }
  }

  async updatePlan(id: string, data: { name?: string; description?: string; price?: number; credits?: number; active?: boolean }) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plano não encontrado');
    return this.prisma.subscriptionPlan.update({ where: { id }, data });
  }

  async deletePlan(id: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plano não encontrado');
    const subs = await this.prisma.subscription.count({ where: { plan_id: id, status: { not: 'cancelled' } } });
    if (subs > 0) throw new BadRequestException('Plano possui assinaturas ativas');
    return this.prisma.subscriptionPlan.update({ where: { id }, data: { active: false } });
  }

  async getUserSubscription(userId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      include: { plan: true, payments: { orderBy: { created_at: 'desc' }, take: 10 } },
    });
    return sub;
  }

  async createSubscription(userId: string, dto: { planId: string; cardToken: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: dto.planId } });
    if (!plan || !plan.active) throw new NotFoundException('Plano não encontrado ou inativo');

    const existing = await this.prisma.subscription.findFirst({
      where: { user_id: userId, status: { in: ['active', 'pending'] } },
    });
    if (existing) throw new ConflictException('Usuário já possui uma assinatura ativa ou pendente');

    const currentStudents = await this.prisma.student.count({
      where: { teacher_id: userId },
    });
    const extraStudents = Math.max(0, currentStudents - plan.max_students);
    const totalAmount = plan.price + extraStudents * ADDITIONAL_STUDENT_PRICE;

    let description = `Talkion - ${plan.name}`;
    if (extraStudents > 0) {
      description += ` + ${extraStudents} aluno(s) adicional(is)`;
    }

    try {
      const mpCustomerId = await this.mp.findOrCreateCustomer(user.email, user.name, userId);

      const payment = await this.mp.createOneTimePayment(
        mpCustomerId,
        dto.cardToken,
        totalAmount,
        description,
        userId,
        user.email,
      );

      if (payment.status !== 'approved') {
        throw new BadRequestException(`Pagamento não aprovado: ${payment.status}`);
      }

      const startDate = new Date();
      const nextBilling = new Date();
      nextBilling.setMonth(nextBilling.getMonth() + 1);

      let mpSubscriptionId: string | null = null;
      if (payment.cardId) {
        try {
          const preapproval = await this.mp.createSubscription(
            mpCustomerId,
            payment.cardId,
            totalAmount,
            plan.name,
            userId,
            user.email,
            nextBilling,
          );
          mpSubscriptionId = preapproval.subscriptionId;
          this.logger.log(`Preapproval created for recurring billing: ${mpSubscriptionId}`);
        } catch (err) {
          this.logger.warn(`Failed to create preapproval, recurring billing disabled: ${(err as Error).message}`);
        }
      }

      const subscription = await this.prisma.subscription.create({
        data: {
          user_id: userId,
          plan_id: plan.id,
          mercadopago_customer_id: mpCustomerId,
          mercadopago_subscription_id: mpSubscriptionId,
          status: 'active',
          next_billing_date: nextBilling,
          card_last_four: payment.lastFourDigits || null,
          card_holder_name: payment.holderName || null,
          payment_method: 'credit_card',
          max_students: plan.max_students,
          additional_students: extraStudents,
        },
      });

      await this.creditsService.resetAndAddCredits(
        userId,
        plan.credits,
        `Créditos do plano ${plan.name}`,
        'subscription_payment',
        String(payment.id),
      );

      await this.prisma.subscriptionPayment.create({
        data: {
          subscription_id: subscription.id,
          mercadopago_payment_id: String(payment.id),
          amount: totalAmount,
          status: 'approved',
          payment_method: 'credit_card',
          paid_at: startDate,
        },
      });

      this.logger.log(
        `Subscription created: ${subscription.id} for user ${userId}` +
        ` (active, R$${totalAmount}, ${currentStudents} alunos, ${extraStudents} adicionais)`,
      );

      return { subscription };
    } catch (err) {
      if (err instanceof ConflictException || err instanceof BadRequestException || err instanceof NotFoundException) {
        throw err;
      }
      this.logger.error(`Failed to create subscription: ${(err as Error).message}`);
      throw new BadRequestException(`Erro ao criar assinatura: ${(err as Error).message}`);
    }
  }

  async createSubscriptionWithCard(userId: string, dto: { planId: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: dto.planId } });
    if (!plan || !plan.active) throw new NotFoundException('Plano não encontrado ou inativo');

    const existing = await this.prisma.subscription.findFirst({
      where: { user_id: userId, status: { in: ['active', 'pending'] } },
    });
    if (existing) throw new ConflictException('Usuário já possui uma assinatura ativa ou pendente');

    const pref = await this.mp.createPreference({
      amount: plan.price,
      description: `Talkion - ${plan.name}`,
      userEmail: user.email,
      userId,
    });

    return { redirectUrl: pref.initPoint, preferenceId: pref.preferenceId };
  }

  async purchaseTopUpWithCard(userId: string, dto: { packId: string }) {
    const pack = TOP_UP_PLANS.find(p => p.id === dto.packId);
    if (!pack) throw new NotFoundException('Pacote de créditos não encontrado');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const pref = await this.mp.createPreference({
      amount: pack.price,
      description: `Talkion - ${pack.name}`,
      userEmail: user.email,
      userId,
      externalReference: `topup:${userId}:${pack.id}`,
    });

    return { redirectUrl: pref.initPoint, preferenceId: pref.preferenceId };
  }

  async purchaseAdditionalStudentsWithCard(userId: string, dto: { quantity: number }) {
    if (dto.quantity < 1) throw new BadRequestException('Quantidade deve ser >= 1');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const sub = await this.prisma.subscription.findFirst({
      where: { user_id: userId, status: { in: ['active', 'pending'] } },
    });
    if (!sub) throw new NotFoundException('Nenhuma assinatura ativa encontrada');

    const totalPrice = dto.quantity * ADDITIONAL_STUDENT_PRICE;

    const pref = await this.mp.createPreference({
      amount: totalPrice,
      description: `Talkion - ${dto.quantity} aluno(s) adicional(is)`,
      userEmail: user.email,
      userId,
      externalReference: `additional:${userId}:${sub.id}:${dto.quantity}`,
    });

    return { redirectUrl: pref.initPoint, preferenceId: pref.preferenceId };
  }

  async cancelSubscription(userId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { user_id: userId, status: { in: ['active', 'pending'] } },
    });
    if (!sub) throw new NotFoundException('Nenhuma assinatura ativa encontrada');

    if (sub.mercadopago_subscription_id) {
      try {
        await this.mp.cancelSubscription(sub.mercadopago_subscription_id);
      } catch (err) {
        this.logger.error(`Failed to cancel MP subscription: ${(err as Error).message}`);
      }
    }

    return this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'cancelled' },
    });
  }

  async changePlan(userId: string, newPlanId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { user_id: userId, status: { in: ['active', 'pending'] } },
      include: { plan: true, user: true },
    });
    if (!sub) throw new NotFoundException('Nenhuma assinatura ativa encontrada');
    if (!sub.user) throw new NotFoundException('Usuário não encontrado');

    const newPlan = await this.prisma.subscriptionPlan.findUnique({ where: { id: newPlanId } });
    if (!newPlan || !newPlan.active) throw new NotFoundException('Plano não encontrado ou inativo');

    const currentStudents = await this.prisma.student.count({ where: { teacher_id: userId } });
    const newExtraStudents = Math.max(0, currentStudents - newPlan.max_students);
    const newTotal = newPlan.price + newExtraStudents * ADDITIONAL_STUDENT_PRICE;

    const now = new Date();

    if (!sub.mercadopago_customer_id) {
      throw new BadRequestException('Nenhum cliente Mercado Pago encontrado');
    }

    const cards = await this.mp.listCustomerCards(sub.mercadopago_customer_id);
    const savedCard = cards[0];
    if (!savedCard) {
      throw new BadRequestException('Nenhum cartão salvo encontrado. Acesse a página de assinatura para cadastrar um novo cartão.');
    }

    const daysInMonth = 30;
    let proratedCharge = 0;
    if (sub.next_billing_date) {
      const msRemaining = new Date(sub.next_billing_date).getTime() - now.getTime();
      const daysRemaining = Math.max(0, msRemaining / (1000 * 60 * 60 * 24));
      const proratedFactor = daysRemaining / daysInMonth;
      proratedCharge = (newTotal - (sub.plan?.price || 0)) * proratedFactor;
    } else {
      proratedCharge = newTotal - (sub.plan?.price || 0);
    }
    proratedCharge = Math.max(0, proratedCharge);

    if (proratedCharge > 0) {
      this.logger.log(`Charging prorated R$${proratedCharge.toFixed(2)} for plan change to ${newPlan.name}`);
      const payment = await this.mp.createOneTimePaymentWithCardId(
        sub.mercadopago_customer_id,
        savedCard.cardId,
        proratedCharge,
        `Talkion - Alteração para ${newPlan.name}`,
        userId,
        sub.user.email,
      );
      if (payment.status !== 'approved') {
        throw new BadRequestException(`Pagamento não aprovado: ${payment.status}. Tente novamente.`);
      }
    }

    if (sub.mercadopago_subscription_id) {
      try {
        await this.mp.cancelSubscription(sub.mercadopago_subscription_id);
      } catch (err) {
        this.logger.warn(`Failed to cancel old MP subscription: ${(err as Error).message}`);
      }
    }

    let mpSubscriptionId: string | null = null;
    try {
      const preapproval = await this.mp.createSubscription(
        sub.mercadopago_customer_id,
        savedCard.cardId,
        newTotal,
        newPlan.name,
        userId,
        sub.user.email,
      );
      mpSubscriptionId = preapproval.subscriptionId;
    } catch (err) {
      this.logger.warn(`Failed to create new preapproval: ${(err as Error).message}`);
    }

    const nextBilling = new Date();
    nextBilling.setMonth(nextBilling.getMonth() + 1);

    const updated = await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        plan_id: newPlanId,
        max_students: newPlan.max_students,
        additional_students: newExtraStudents,
        mercadopago_subscription_id: mpSubscriptionId,
        next_billing_date: nextBilling,
        card_last_four: savedCard.lastFourDigits || sub.card_last_four,
        card_holder_name: savedCard.holderName || sub.card_holder_name,
      },
    });

    await this.creditsService.resetAndAddCredits(
      userId,
      newPlan.credits,
      `Créditos do plano ${newPlan.name} (alteração)`,
      'subscription_payment',
      `plan_change_${newPlanId}_${Date.now()}`,
    );

    this.logger.log(`Subscription ${sub.id} changed to plan ${newPlan.name} (${newPlanId})`);
    return updated;
  }

  async getPaymentHistory(userId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { user_id: userId, status: { not: 'cancelled' } },
    });
    if (!sub) return [];
    return this.prisma.subscriptionPayment.findMany({
      where: { subscription_id: sub.id },
      orderBy: { created_at: 'desc' },
    });
  }

  async handlePaymentApproved(mpPaymentId: string, subscriptionId: string, amount: number, paidAt: string, paymentMethod: string) {
    const existing = await this.prisma.subscriptionPayment.findUnique({
      where: { mercadopago_payment_id: mpPaymentId },
    });
    if (existing) {
      this.logger.log(`Payment ${mpPaymentId} already processed, skipping`);
      return existing;
    }

    const sub = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { user: true },
    });
    if (!sub) throw new NotFoundException('Assinatura não encontrada');

    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: sub.plan_id } });
    if (!plan) throw new NotFoundException('Plano não encontrado');

    const payment = await this.prisma.subscriptionPayment.create({
      data: {
        subscription_id: subscriptionId,
        mercadopago_payment_id: mpPaymentId,
        amount,
        status: 'approved',
        payment_method: paymentMethod,
        paid_at: new Date(paidAt),
      },
    });

    await this.creditsService.resetAndAddCredits(
      sub.user_id,
      plan.credits,
      `Créditos do plano ${plan.name}`,
      'subscription_payment',
      mpPaymentId,
    );

    const currentStudents = await this.prisma.student.count({
      where: { teacher_id: sub.user_id },
    });
    const extraStudents = Math.max(0, currentStudents - plan.max_students);
    const nextAmount = plan.price + extraStudents * ADDITIONAL_STUDENT_PRICE;

    const nextBilling = new Date();
    nextBilling.setMonth(nextBilling.getMonth() + 1);

    const updateData: any = {
      next_billing_date: nextBilling,
      status: 'active',
      additional_students: extraStudents,
    };
    if (sub.mercadopago_subscription_id && nextAmount !== amount) {
      try {
        await this.mp.updateSubscriptionAmount(sub.mercadopago_subscription_id, nextAmount);
        this.logger.log(`Preapproval ${sub.mercadopago_subscription_id} amount updated to ${nextAmount}`);
      } catch (err) {
        this.logger.warn(`Failed to update preapproval amount: ${(err as Error).message}`);
      }
    }
    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: updateData,
    });

    this.logger.log(
      `Payment ${mpPaymentId} processed: +${plan.credits} credits for user ${sub.user_id}` +
      ` (${currentStudents} alunos, ${extraStudents} adicionais, próx: R$${nextAmount})`,
    );

    await this.mailService.sendPaymentApprovedEmail(sub.user.email, sub.user.name, plan.name, amount, plan.credits);

    return payment;
  }

  async handlePaymentRejected(mpPaymentId: string, subscriptionId: string, amount: number) {
    const existing = await this.prisma.subscriptionPayment.findUnique({
      where: { mercadopago_payment_id: mpPaymentId },
    });
    if (existing) {
      this.logger.log(`Rejected payment ${mpPaymentId} already recorded, skipping`);
      return existing;
    }

    const sub = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { user: true, plan: true },
    });
    if (!sub) throw new NotFoundException('Assinatura não encontrada');

    const payment = await this.prisma.subscriptionPayment.create({
      data: {
        subscription_id: subscriptionId,
        mercadopago_payment_id: mpPaymentId,
        amount,
        status: 'rejected',
      },
    });

    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'past_due' },
    });

    this.logger.log(`Payment ${mpPaymentId} rejected, subscription ${subscriptionId} past due`);

    await this.mailService.sendPaymentRejectedEmail(sub.user.email, sub.user.name, sub.plan.name, amount);

    return payment;
  }

  async handleSubscriptionCancelled(mpSubscriptionId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { mercadopago_subscription_id: mpSubscriptionId },
    });
    if (!sub) throw new NotFoundException('Assinatura não encontrada');

    return this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'cancelled' },
    });
  }

  async handleSubscriptionPaused(mpSubscriptionId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { mercadopago_subscription_id: mpSubscriptionId },
    });
    if (!sub) throw new NotFoundException('Assinatura não encontrada');

    return this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'cancelled' },
    });
  }

  async handleSubscriptionUpdated(mpSubscriptionId: string, data: { planId?: string; nextBillingDate?: string; status?: string }) {
    const sub = await this.prisma.subscription.findUnique({
      where: { mercadopago_subscription_id: mpSubscriptionId },
    });
    if (!sub) throw new NotFoundException('Assinatura não encontrada');

    const updateData: any = {};
    if (data.status) updateData.status = this.mapMPStatus(data.status);
    if (data.nextBillingDate) updateData.next_billing_date = new Date(data.nextBillingDate);
    if (data.planId) updateData.plan_id = data.planId;

    return this.prisma.subscription.update({ where: { id: sub.id }, data: updateData });
  }

  async findSubscriptionByMpId(mpSubscriptionId: string) {
    return this.prisma.subscription.findUnique({
      where: { mercadopago_subscription_id: mpSubscriptionId },
    });
  }

  async handleTopUpApproved(mpPaymentId: string, userId: string, packId: string) {
    const pack = TOP_UP_PLANS.find(p => p.id === packId);
    if (!pack) {
      this.logger.warn(`Top-up pack not found: ${packId} for payment ${mpPaymentId}`);
      return;
    }

    const existing = await this.prisma.creditTransaction.findFirst({
      where: { reference_id: mpPaymentId, reference_type: 'topup' },
    });
    if (existing) {
      this.logger.log(`Top-up payment ${mpPaymentId} already processed, skipping`);
      return;
    }

    await this.creditsService.addCredits(
      userId,
      pack.credits,
      `Compra de ${pack.name}`,
      'topup',
      mpPaymentId,
    );

    this.logger.log(`Top-up approved: +${pack.credits} credits for user ${userId} (payment ${mpPaymentId})`);
  }

  async handleAdditionalStudentsApproved(mpPaymentId: string, userId: string, subscriptionId: string, quantity: number) {
    const sub = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });
    if (!sub) {
      this.logger.warn(`Subscription not found for additional students: ${subscriptionId}`);
      return;
    }

    const existing = await this.prisma.creditTransaction.findFirst({
      where: { reference_id: mpPaymentId, reference_type: 'additional_students' },
    });
    if (existing) {
      this.logger.log(`Additional students payment ${mpPaymentId} already processed, skipping`);
      return;
    }

    const newAdditional = sub.additional_students + quantity;
    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { additional_students: newAdditional },
    });

    this.logger.log(`Additional students approved: +${quantity} for user ${userId} (payment ${mpPaymentId})`);
  }

  async getCurrentStudents(userId: string): Promise<number> {
    return this.prisma.student.count({ where: { teacher_id: userId } });
  }

  private mapMPStatus(mpStatus: string): string {
    const map: Record<string, string> = {
      authorized: 'active',
      pending: 'pending',
      paused: 'paused',
      cancelled: 'cancelled',
    };
    return map[mpStatus] || 'pending';
  }
}
