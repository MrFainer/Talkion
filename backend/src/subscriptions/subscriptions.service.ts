import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { MercadoPagoService } from './mercadopago.service';
import { MailService } from '../auth/mail.service';
import { CreditsService } from '../credits/credits.service';
import { AffiliateService } from '../affiliate/affiliate.service';

const COMMISSION_PERCENT = 0.3;

const ADDITIONAL_STUDENT_PRICE = 3.9;

const REJECTION_REASON_MAP: Record<string, string> = {
  cc_rejected_insufficient_amount: 'Saldo insuficiente no cartão.',
  cc_rejected_card_disabled: 'Seu cartão está bloqueado ou desativado.',
  cc_rejected_card_high_risk: 'O cartão foi recusado por risco de fraude.',
  cc_rejected_bad_filled_security_code:
    'O código de segurança (CVV) do cartão está incorreto.',
  cc_rejected_bad_filled_date: 'A data de validade do cartão está incorreta.',
  cc_rejected_bad_filled_card_number: 'O número do cartão está incorreto.',
  cc_rejected_expired_card: 'Seu cartão está vencido.',
  cc_rejected_max_attempts:
    'O cartão passou do limite de tentativas permitidas.',
  cc_rejected_other_reason: 'O pagamento foi recusado pelo emissor do cartão.',
  cc_rejected_blacklist: 'O cartão foi bloqueado pelo emissor.',
  cc_rejected_card_not_supported: 'Este tipo de cartão não é aceito.',
  cc_rejected_call_for_authorize:
    'O emissor pede que você autorize o pagamento.',
  cc_rejected_high_risk: 'O pagamento foi recusado por análise de risco.',
  cc_amount_rate_limit_exceeded:
    'Houve muitas tentativas de pagamento. Tente novamente mais tarde.',
  cc_rejected_bad_filled_other:
    'Alguns dados informados do cartão estão incorretos.',
};

function friendlyRejectionReason(statusDetail?: string): string {
  if (!statusDetail) {
    return 'O emissor do seu cartão recusou o pagamento.';
  }
  return (
    REJECTION_REASON_MAP[statusDetail] ||
    `O pagamento foi recusado. (${statusDetail})`
  );
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    public readonly mp: MercadoPagoService,
    private readonly mailService: MailService,
    private readonly creditsService: CreditsService,
    private readonly affiliateService: AffiliateService,
  ) {}

  async listPlans() {
    return this.prisma.subscriptionPlan.findMany({
      where: { active: true },
      orderBy: { sort_order: 'asc' },
    });
  }

  async createPlan(data: {
    name: string;
    description?: string;
    price: number;
    credits: number;
    max_students?: number;
  }) {
    const plan = await this.prisma.subscriptionPlan.create({
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        credits: data.credits,
        max_students: data.max_students ?? 50,
      },
    });
    this.logger.log(
      `Plan created: ${plan.id} - ${plan.name} (${plan.max_students} alunos)`,
    );
    return plan;
  }

  async getTopUpPlans() {
    return this.prisma.creditPack.findMany({
      where: { active: true },
      orderBy: { sort_order: 'asc' },
      select: { id: true, name: true, credits: true, price: true },
    });
  }

  async purchaseTopUp(
    userId: string,
    dto: { packId: string; cardToken: string },
  ) {
    const pack = await this.prisma.creditPack.findUnique({
      where: { id: dto.packId },
    });
    if (!pack) throw new NotFoundException('Pacote de créditos não encontrado');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    try {
      const mpCustomerId = await this.mp.findOrCreateCustomer(
        user.email,
        user.name,
        userId,
      );

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
      throw new BadRequestException(
        `Erro na compra: ${(err as Error).message}`,
      );
    }
  }

  async purchaseAdditionalStudents(
    userId: string,
    dto: { quantity: number; cardToken: string },
  ) {
    if (dto.quantity < 1)
      throw new BadRequestException('Quantidade deve ser >= 1');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const sub = await this.prisma.subscription.findFirst({
      where: { user_id: userId, status: { in: ['active', 'pending'] } },
    });
    if (!sub)
      throw new NotFoundException('Nenhuma assinatura ativa encontrada');

    const totalPrice = dto.quantity * ADDITIONAL_STUDENT_PRICE;

    try {
      const mpCustomerId = await this.mp.findOrCreateCustomer(
        user.email,
        user.name,
        userId,
      );

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
          const planData = await this.prisma.subscriptionPlan.findUnique({
            where: { id: sub.plan_id },
          });
          if (planData) {
            const nextAmount =
              planData.price + newAdditional * ADDITIONAL_STUDENT_PRICE;
            try {
              await this.mp.updateSubscriptionAmount(
                sub.mercadopago_subscription_id,
                nextAmount,
              );
              this.logger.log(
                `Preapproval ${sub.mercadopago_subscription_id} amount updated to ${nextAmount}`,
              );
            } catch (err) {
              this.logger.warn(
                `Failed to update preapproval amount: ${(err as Error).message}`,
              );
            }
          }
        }
        this.logger.log(
          `Additional students added: +${dto.quantity} for user ${userId}`,
        );
        return {
          success: true,
          totalStudents: sub.max_students + updated.additional_students,
        };
      }

      return { success: false, status: payment.status, paymentId: payment.id };
    } catch (err) {
      this.logger.error(
        `Additional students purchase failed: ${(err as Error).message}`,
      );
      throw new BadRequestException(
        `Erro na compra: ${(err as Error).message}`,
      );
    }
  }

  async updatePlan(
    id: string,
    data: {
      name?: string;
      description?: string;
      price?: number;
      credits?: number;
      active?: boolean;
    },
  ) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
    });
    if (!plan) throw new NotFoundException('Plano não encontrado');
    return this.prisma.subscriptionPlan.update({ where: { id }, data });
  }

  async deletePlan(id: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
    });
    if (!plan) throw new NotFoundException('Plano não encontrado');
    const subs = await this.prisma.subscription.count({
      where: { plan_id: id, status: { not: 'cancelled' } },
    });
    if (subs > 0)
      throw new BadRequestException('Plano possui assinaturas ativas');
    return this.prisma.subscriptionPlan.update({
      where: { id },
      data: { active: false },
    });
  }

  async getUserSubscription(userId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { user_id: userId, status: { not: 'cancelled' } },
      orderBy: { created_at: 'desc' },
      include: {
        plan: true,
        payments: { orderBy: { created_at: 'desc' } },
      },
    });

    if (sub) {
      const allPayments = await this.prisma.subscriptionPayment.findMany({
        where: {
          subscription: { user_id: userId },
        },
        orderBy: { created_at: 'desc' },
      });
      sub.payments = allPayments;
    }

    if (sub?.plan?.is_free) {
      sub.next_billing_date = null;
    }

    return sub;
  }

  async createSubscription(
    userId: string,
    dto: { planId: string; cardToken: string; subscriptionCardToken?: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: dto.planId },
    });
    if (!plan || !plan.active)
      throw new NotFoundException('Plano não encontrado ou inativo');

    const existing = await this.prisma.subscription.findFirst({
      where: { user_id: userId, status: { in: ['active', 'pending'] } },
      include: { plan: true },
    });
    if (existing) {
      if (existing.plan?.is_free) {
        await this.prisma.subscription.update({
          where: { id: existing.id },
          data: { status: 'cancelled' },
        });
      } else {
        throw new ConflictException(
          'Usuário já possui uma assinatura ativa ou pendente',
        );
      }
    }

    if (plan.is_free) {
      const existingFree = await this.prisma.subscription.findFirst({
        where: { user_id: userId, plan: { is_free: true }, status: 'active' },
      });
      if (existingFree)
        throw new ConflictException('Usuário já possui o plano gratuito');

      const subscription = await this.prisma.subscription.create({
        data: {
          user_id: userId,
          plan_id: plan.id,
          status: 'active',
          max_students: plan.max_students,
        },
      });

      await this.creditsService.resetAndAddCredits(
        userId,
        plan.credits,
        `Créditos do plano ${plan.name}`,
        'free_plan',
        subscription.id,
      );

      return { subscription };
    }

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
      const mpCustomerId = await this.mp.findOrCreateCustomer(
        user.email,
        user.name,
        userId,
      );

      const card = await this.mp.associateCard(mpCustomerId, dto.cardToken);

      const payment = await this.mp.createOneTimePayment(
        mpCustomerId,
        dto.cardToken,
        totalAmount,
        description,
        userId,
        user.email,
      );

      if (payment.status !== 'approved') {
        throw new BadRequestException(
          `Pagamento não aprovado: ${payment.status}`,
        );
      }

      const startDate = new Date();
      const nextBilling = new Date();
      nextBilling.setMonth(nextBilling.getMonth() + 1);

      let mpSubscriptionId: string | null = null;
      try {
        const preapproval = await this.mp.createSubscription(
          mpCustomerId,
          card.cardId,
          totalAmount,
          plan.name,
          userId,
          user.email,
          nextBilling,
          dto.subscriptionCardToken,
        );
        mpSubscriptionId = preapproval.subscriptionId;
        this.logger.log(
          `Preapproval created for recurring billing: ${mpSubscriptionId}`,
        );
      } catch (err) {
        this.logger.warn(
          `Failed to create preapproval, recurring billing disabled: ${(err as Error).message}`,
        );
      }

      const subscription = await this.prisma.subscription.create({
        data: {
          user_id: userId,
          plan_id: plan.id,
          mercadopago_customer_id: mpCustomerId,
          mercadopago_card_id: card.cardId,
          mercadopago_subscription_id: mpSubscriptionId,
          status: 'active',
          next_billing_date: nextBilling,
          card_last_four: card.lastFourDigits || null,
          card_holder_name: card.holderName || null,
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
          ` (active, R$${totalAmount}, ${currentStudents} alunos, ${extraStudents} adicionais)` +
          ` cardId: ${card.cardId}, preapprovalId: ${mpSubscriptionId}`,
      );

      if (user.referred_by) {
        try {
          const referrer = await this.prisma.user.findUnique({
            where: { referral_code: user.referred_by },
            select: { id: true },
          });
          if (referrer) {
            const commissionAmount = totalAmount * COMMISSION_PERCENT;
            await this.affiliateService.createCommission(
              referrer.id,
              userId,
              subscription.id,
              commissionAmount,
            );
          }
        } catch (err) {
          this.logger.warn(
            `Failed to create affiliate commission: ${(err as Error).message}`,
          );
        }
      }

      return { subscription };
    } catch (err) {
      if (
        err instanceof ConflictException ||
        err instanceof BadRequestException ||
        err instanceof NotFoundException
      ) {
        throw err;
      }
      this.logger.error(
        `Failed to create subscription: ${(err as Error).message}`,
      );
      throw new BadRequestException(
        `Erro ao criar assinatura: ${(err as Error).message}`,
      );
    }
  }

  async createSubscriptionWithCard(userId: string, dto: { planId: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: dto.planId },
    });
    if (!plan || !plan.active)
      throw new NotFoundException('Plano não encontrado ou inativo');

    const existing = await this.prisma.subscription.findFirst({
      where: { user_id: userId, status: { in: ['active', 'pending'] } },
    });
    if (existing)
      throw new ConflictException(
        'Usuário já possui uma assinatura ativa ou pendente',
      );

    const pref = await this.mp.createPreference({
      amount: plan.price,
      description: `Talkion - ${plan.name}`,
      userEmail: user.email,
      userId,
    });

    return { redirectUrl: pref.initPoint, preferenceId: pref.preferenceId };
  }

  async purchaseTopUpWithCard(userId: string, dto: { packId: string }) {
    const pack = await this.prisma.creditPack.findUnique({
      where: { id: dto.packId },
    });
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

  async purchaseAdditionalStudentsWithCard(
    userId: string,
    dto: { quantity: number },
  ) {
    if (dto.quantity < 1)
      throw new BadRequestException('Quantidade deve ser >= 1');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const sub = await this.prisma.subscription.findFirst({
      where: { user_id: userId, status: { in: ['active', 'pending'] } },
    });
    if (!sub)
      throw new NotFoundException('Nenhuma assinatura ativa encontrada');

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

  async retryCreatePreapproval(
    userId: string,
    body?: { subscriptionCardToken?: string; cvv?: string },
  ) {
    const sub = await this.prisma.subscription.findFirst({
      where: { user_id: userId, status: { in: ['active', 'pending'] } },
      include: { plan: true, user: true },
    });
    if (!sub)
      throw new NotFoundException('Nenhuma assinatura ativa encontrada');
    if (sub.mercadopago_subscription_id)
      throw new BadRequestException('Assinatura já possui preapproval');
    if (!sub.mercadopago_customer_id)
      throw new BadRequestException('Nenhum customer MP encontrado');
    if (!sub.mercadopago_card_id)
      throw new BadRequestException('Nenhum cartão MP encontrado');
    if (!sub.user) throw new NotFoundException('Usuário não encontrado');
    if (!sub.plan) throw new NotFoundException('Plano não encontrado');

    let token = body?.subscriptionCardToken;
    if (!token && body?.cvv) {
      token = await this.mp.createCardTokenFromSavedCard(
        sub.mercadopago_card_id,
        body.cvv,
      );
    }

    const preapproval = await this.mp.createSubscription(
      sub.mercadopago_customer_id,
      sub.mercadopago_card_id,
      sub.plan.price,
      sub.plan.name,
      userId,
      sub.user.email,
      sub.next_billing_date || undefined,
      token,
    );

    const updated = await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { mercadopago_subscription_id: preapproval.subscriptionId },
    });

    this.logger.log(
      `Preapproval retry successful: ${preapproval.subscriptionId} for subscription ${sub.id}`,
    );

    return {
      subscriptionId: updated.id,
      mercadopagoSubscriptionId: preapproval.subscriptionId,
      status: preapproval.status,
    };
  }

  async cancelSubscription(userId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: {
        user_id: userId,
        status: { in: ['active', 'pending', 'past_due'] },
      },
    });
    if (!sub)
      throw new NotFoundException('Nenhuma assinatura ativa encontrada');

    if (sub.mercadopago_subscription_id) {
      try {
        await this.mp.cancelSubscription(sub.mercadopago_subscription_id);
      } catch (err) {
        this.logger.error(
          `Failed to cancel MP subscription: ${(err as Error).message}`,
        );
      }
    }

    return this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'cancelled' },
    });
  }

  async updateSubscriptionCard(
    userId: string,
    dto: { cardToken: string; subscriptionCardToken?: string },
  ) {
    const sub = await this.prisma.subscription.findFirst({
      where: {
        user_id: userId,
        status: { in: ['active', 'pending', 'past_due'] },
      },
      include: { user: true, plan: true },
    });
    if (!sub)
      throw new NotFoundException('Nenhuma assinatura ativa encontrada');
    if (!sub.user) throw new NotFoundException('Usuário não encontrado');
    if (!sub.plan) throw new NotFoundException('Plano não encontrado');

    const mpCustomerId =
      sub.mercadopago_customer_id ||
      (await this.mp.findOrCreateCustomer(
        sub.user.email,
        sub.user.name,
        userId,
      ));

    const card = await this.mp.associateCard(mpCustomerId, dto.cardToken);

    const totalAmount =
      sub.plan.price +
      (sub.additional_students || 0) * ADDITIONAL_STUDENT_PRICE;

    // Detecta se existe cobrança em aberto (pagamento recusado/estornado).
    // Nesse caso, a cobrança pendente deve ser feita na hora, no novo cartão,
    // e não apenas na próxima data de cobrança.
    const latestPayment = await this.prisma.subscriptionPayment.findFirst({
      where: { subscription_id: sub.id },
      orderBy: { created_at: 'desc' },
    });
    const latestRejected =
      latestPayment &&
      ['rejected', 'refunded', 'cancelled', 'charged_back'].includes(
        latestPayment.status,
      );
    const isDelinquent = sub.status === 'past_due' || !!latestRejected;

    const originalBilling = sub.next_billing_date
      ? new Date(sub.next_billing_date)
      : null;
    const futureBilling =
      originalBilling && originalBilling.getTime() > Date.now()
        ? originalBilling
        : null;
    let nextBilling = futureBilling;
    if (!nextBilling) {
      nextBilling = new Date();
      nextBilling.setMonth(nextBilling.getMonth() + 1);
    }

    // Recreates the preapproval with the new card. Mercado Pago does not allow
    // changing the card on an existing preapproval, so we cancel the old one
    // and create a fresh recurring agreement bound to the new card.
    if (sub.mercadopago_subscription_id) {
      try {
        await this.mp.cancelSubscription(sub.mercadopago_subscription_id);
      } catch (err) {
        this.logger.warn(
          `Failed to cancel old MP subscription: ${(err as Error).message}`,
        );
      }
    }

    // Cobrança imediata da parcela em atraso, se houver. Somente quando a
    // assinatura está com pagamento recusado/pendente — assim o professor
    // regulariza na hora ao trocar o cartão.
    let catchUpPayment: { id?: number; status?: string } | null = null;
    let catchUpError: string | null = null;
    if (isDelinquent) {
      try {
        catchUpPayment = await this.mp.createOneTimePayment(
          mpCustomerId,
          dto.cardToken,
          totalAmount,
          `Talkion - ${sub.plan.name} (cobrança em atraso)`,
          userId,
          sub.user.email,
        );
        if (catchUpPayment.status !== 'approved') {
          let detail: string | undefined;
          if (catchUpPayment.id) {
            try {
              detail = (await this.mp.getPayment(String(catchUpPayment.id)))
                ?.status_detail;
            } catch (err) {
              this.logger.warn(
                `Failed to fetch status_detail for catch-up payment ${catchUpPayment.id}: ${(err as Error).message}`,
              );
            }
          }
          catchUpError = friendlyRejectionReason(detail);
          this.logger.warn(
            `Catch-up charge rejected for subscription ${sub.id}: ${catchUpError}`,
          );
        } else {
          this.logger.log(
            `Catch-up charge approved for subscription ${sub.id}: payment ${catchUpPayment.id} (R$${totalAmount})`,
          );
        }
      } catch (err) {
        catchUpError = (err as Error).message;
        this.logger.warn(
          `Catch-up charge failed for subscription ${sub.id}: ${catchUpError}`,
        );
      }
    }

    const catchUpApproved =
      !!catchUpPayment && catchUpPayment.status === 'approved';

    let nextStatus = 'active';
    let nextBillingForDb = nextBilling;
    if (isDelinquent) {
      if (catchUpApproved) {
        // Pagamento em atraso quitado: avança o ciclo para o próximo mês.
        nextBillingForDb = new Date();
        nextBillingForDb.setMonth(nextBillingForDb.getMonth() + 1);
        nextBilling = nextBillingForDb;
        nextStatus = 'active';
      } else {
        // Continua inadimplente até a cobrança ser aprovada: mantém a data
        // limite original (para o bloqueio continuar valendo) e usa uma data
        // futura apenas para o novo preapproval.
        nextBillingForDb = originalBilling || nextBilling;
        nextStatus = 'past_due';
      }
    }

    let mpSubscriptionId: string | null = null;
    try {
      const preapproval = await this.mp.createSubscription(
        mpCustomerId,
        card.cardId,
        totalAmount,
        sub.plan.name,
        userId,
        sub.user.email,
        nextBilling,
        dto.subscriptionCardToken,
      );
      mpSubscriptionId = preapproval.subscriptionId;
      this.logger.log(
        `Preapproval recreated after card update: ${mpSubscriptionId}`,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to recreate preapproval after card update: ${(err as Error).message}`,
      );
    }

    const updated = await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        mercadopago_customer_id: mpCustomerId,
        mercadopago_card_id: card.cardId,
        mercadopago_subscription_id: mpSubscriptionId,
        card_last_four: card.lastFourDigits || null,
        card_holder_name: card.holderName || null,
        payment_method: 'credit_card',
        next_billing_date: nextBillingForDb,
        status: nextStatus,
      },
    });

    if (catchUpApproved && catchUpPayment?.id) {
      await this.prisma.subscriptionPayment.create({
        data: {
          subscription_id: sub.id,
          mercadopago_payment_id: String(catchUpPayment.id),
          amount: totalAmount,
          status: 'approved',
          payment_method: 'credit_card',
          paid_at: new Date(),
        },
      });

      await this.creditsService.resetAndAddCredits(
        userId,
        sub.plan.credits,
        `Créditos do plano ${sub.plan.name}`,
        'subscription_payment',
        String(catchUpPayment.id),
      );
    }

    if (isDelinquent && !catchUpApproved) {
      throw new BadRequestException(
        `Cartão atualizado, mas a cobrança em atraso de R$${totalAmount.toFixed(2)} não foi aprovada. ${catchUpError || 'Tente novamente com outro cartão.'}`,
      );
    }

    this.logger.log(
      `Card updated for subscription ${sub.id}: •••• ${card.lastFourDigits} (status ${nextStatus}, catchUp ${catchUpApproved ? 'approved' : 'none'})`,
    );

    return {
      subscriptionId: updated.id,
      card_last_four: updated.card_last_four,
      card_holder_name: updated.card_holder_name,
      status: updated.status,
      catch_up_charged: catchUpApproved,
    };
  }

  async changePlan(userId: string, newPlanId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { user_id: userId, status: { in: ['active', 'pending'] } },
      include: { plan: true, user: true },
    });
    if (!sub)
      throw new NotFoundException('Nenhuma assinatura ativa encontrada');
    if (!sub.user) throw new NotFoundException('Usuário não encontrado');

    const newPlan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: newPlanId },
    });
    if (!newPlan || !newPlan.active)
      throw new NotFoundException('Plano não encontrado ou inativo');

    if (newPlan.is_free) {
      if (sub.mercadopago_subscription_id) {
        try {
          await this.mp.cancelSubscription(sub.mercadopago_subscription_id);
        } catch (err) {
          this.logger.warn(
            `Failed to cancel MP subscription: ${(err as Error).message}`,
          );
        }
      }

      await this.creditsService.resetAndAddCredits(
        userId,
        newPlan.credits,
        `Créditos do plano ${newPlan.name}`,
        'free_plan',
        sub.id,
      );

      return this.prisma.subscription.update({
        where: { id: sub.id },
        data: {
          plan_id: newPlanId,
          status: 'active',
          max_students: newPlan.max_students,
          additional_students: 0,
          mercadopago_subscription_id: null,
          mercadopago_card_id: null,
          mercadopago_customer_id: null,
          card_last_four: null,
          card_holder_name: null,
          next_billing_date: null,
          payment_method: null,
        },
      });
    }

    const currentStudents = await this.prisma.student.count({
      where: { teacher_id: userId },
    });
    const newExtraStudents = Math.max(
      0,
      currentStudents - newPlan.max_students,
    );
    const newTotal =
      newPlan.price + newExtraStudents * ADDITIONAL_STUDENT_PRICE;

    const now = new Date();

    if (!sub.mercadopago_customer_id) {
      throw new BadRequestException('Nenhum cliente Mercado Pago encontrado');
    }

    let savedCardId = sub.mercadopago_card_id;
    if (!savedCardId) {
      const cards = await this.mp.listCustomerCards(
        sub.mercadopago_customer_id,
      );
      const savedCard = cards[0];
      savedCardId = savedCard?.cardId || null;
    }
    if (!savedCardId) {
      throw new BadRequestException(
        'Nenhum cartão salvo encontrado. Acesse a página de assinatura para cadastrar um novo cartão.',
      );
    }

    const daysInMonth = 30;
    let proratedCharge = 0;
    if (sub.next_billing_date) {
      const msRemaining =
        new Date(sub.next_billing_date).getTime() - now.getTime();
      const daysRemaining = Math.max(0, msRemaining / (1000 * 60 * 60 * 24));
      const proratedFactor = daysRemaining / daysInMonth;
      proratedCharge = (newTotal - (sub.plan?.price || 0)) * proratedFactor;
    } else {
      proratedCharge = newTotal - (sub.plan?.price || 0);
    }
    proratedCharge = Math.max(0, proratedCharge);

    if (proratedCharge > 0) {
      this.logger.log(
        `Charging prorated R$${proratedCharge.toFixed(2)} for plan change to ${newPlan.name}`,
      );
      const payment = await this.mp.createOneTimePaymentWithCardId(
        sub.mercadopago_customer_id,
        savedCardId,
        proratedCharge,
        `Talkion - Alteração para ${newPlan.name}`,
        userId,
        sub.user.email,
      );
      if (payment.status !== 'approved') {
        throw new BadRequestException(
          `Pagamento não aprovado: ${payment.status}. Tente novamente.`,
        );
      }
    }

    if (sub.mercadopago_subscription_id) {
      try {
        await this.mp.cancelSubscription(sub.mercadopago_subscription_id);
      } catch (err) {
        this.logger.warn(
          `Failed to cancel old MP subscription: ${(err as Error).message}`,
        );
      }
    }

    let mpSubscriptionId: string | null = null;
    try {
      const preapproval = await this.mp.createSubscription(
        sub.mercadopago_customer_id,
        savedCardId,
        newTotal,
        newPlan.name,
        userId,
        sub.user.email,
      );
      mpSubscriptionId = preapproval.subscriptionId;
    } catch (err) {
      this.logger.warn(
        `Failed to create new preapproval: ${(err as Error).message}`,
      );
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
        card_last_four: sub.card_last_four,
        card_holder_name: sub.card_holder_name,
      },
    });

    await this.creditsService.resetAndAddCredits(
      userId,
      newPlan.credits,
      `Créditos do plano ${newPlan.name} (alteração)`,
      'subscription_payment',
      `plan_change_${newPlanId}_${Date.now()}`,
    );

    this.logger.log(
      `Subscription ${sub.id} changed to plan ${newPlan.name} (${newPlanId})`,
    );
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

  async reconcileSubscriptionPayments(userId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { user_id: userId, status: { not: 'cancelled' } },
      orderBy: { created_at: 'desc' },
      include: { user: true },
    });
    if (!sub)
      throw new NotFoundException('Nenhuma assinatura ativa encontrada');

    let mpPayments: any[] = [];
    try {
      mpPayments = await this.mp
        .searchPaymentsByExternalReference(sub.user_id)
        .catch((err) => {
          this.logger.warn(
            `MP search by external_reference failed for reconcile: ${(err as Error).message}`,
          );
          return [];
        });
      mpPayments.sort(
        (a: any, b: any) =>
          new Date(b.date_created || 0).getTime() -
          new Date(a.date_created || 0).getTime(),
      );
    } catch (err) {
      this.logger.warn(
        `MP payment search failed for reconcile (continuing with local data): ${(err as Error).message}`,
      );
    }

    // Fallback: busca pagamentos por preapproval_id quando o search por
    // external_reference não encontrou nada. Pagamentos recorrentes gerados
    // pelo preapproval podem não trazer external_reference.
    if (mpPayments.length === 0 && sub.mercadopago_subscription_id) {
      try {
        const preapprovalPayments = await this.mp
          .searchPaymentsByPreapprovalId(sub.mercadopago_subscription_id)
          .catch(() => []);
        if (preapprovalPayments.length > 0) {
          this.logger.log(
            `Reconcile fallback: found ${preapprovalPayments.length} payments by preapproval_id ${sub.mercadopago_subscription_id}`,
          );
          mpPayments = preapprovalPayments;
          mpPayments.sort(
            (a: any, b: any) =>
              new Date(b.date_created || 0).getTime() -
              new Date(a.date_created || 0).getTime(),
          );
        }
      } catch {
        // Ignora erro no fallback
      }
    }

    let created = 0;
    let updated = 0;
    const newRejected: any[] = [];

    for (const mpPay of mpPayments) {
      const mpId = String(mpPay.id || '');
      const status = mpPay.status;
      const existing = mpId
        ? await this.prisma.subscriptionPayment.findUnique({
            where: { mercadopago_payment_id: mpId },
          })
        : null;

      if (!mpId) continue;
      const data = {
        mercadopago_payment_id: mpId,
        amount: parseFloat(mpPay.transaction_amount || '0'),
        status_detail: mpPay.status_detail || null,
        rejection_reason:
          status === 'approved'
            ? null
            : friendlyRejectionReason(mpPay.status_detail),
        paid_at:
          mpPay.date_approved || mpPay.date_created
            ? new Date(mpPay.date_approved || mpPay.date_created)
            : null,
      };

      if (existing) {
        await this.prisma.subscriptionPayment.update({
          where: { id: existing.id },
          data: {
            status_detail: existing.status_detail
              ? existing.status_detail
              : data.status_detail,
            rejection_reason: existing.rejection_reason
              ? existing.rejection_reason
              : data.rejection_reason,
            paid_at: existing.paid_at ? existing.paid_at : data.paid_at,
          },
        });
        updated++;
      } else {
        await this.prisma.subscriptionPayment.create({
          data: {
            subscription_id: sub.id,
            status,
            ...data,
          },
        });
        if (status !== 'approved') newRejected.push({ ...data, status });
        created++;
      }
    }

    // Mescla os pagamentos do Mercado Pago com o histórico local
    // (subscription_payment), que é alimentado pelos webhooks. A decisão do
    // status leva em conta o registro mais recente entre as duas fontes.
    const localPayments = await this.prisma.subscriptionPayment.findMany({
      where: { subscription_id: sub.id },
      orderBy: { created_at: 'desc' },
    });

    const latestLocal = localPayments[0];
    const latestMp = mpPayments[0];

    const localDate = latestLocal
      ? new Date(
          latestLocal.paid_at?.toISOString() ||
            latestLocal.created_at.toISOString(),
        ).getTime()
      : -1;
    const mpDate = latestMp
      ? new Date(latestMp.date_created || latestMp.date_approved || 0).getTime()
      : -1;

    let effective: { status: string; date: Date } | null = null;
    if (latestMp && mpDate >= localDate) {
      const d = new Date(latestMp.date_created || latestMp.date_approved);
      effective = {
        status: latestMp.status,
        date: isNaN(d.getTime()) ? new Date() : d,
      };
    } else if (latestLocal) {
      effective = {
        status: latestLocal.status,
        date: latestLocal.paid_at || latestLocal.created_at || new Date(),
      };
    }

    const isRejectedStatus = (status: string) =>
      ['rejected', 'refunded', 'cancelled', 'charged_back'].includes(status);

    if (effective && isRejectedStatus(effective.status)) {
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'past_due' },
      });
      this.logger.log(
        `Reconcile for user ${userId}: latest payment rejected (${effective.status}), subscription set to past_due`,
      );
    } else if (effective?.status === 'approved') {
      // Regulariza a assinatura: reativa. Só recalcula next_billing_date
      // se não existir uma data futura (ex: controlada pelo webhook do MP).
      const now = new Date();
      const hasFutureBilling =
        sub.next_billing_date && new Date(sub.next_billing_date) > now;
      const updateData: any = { status: 'active' };
      if (!hasFutureBilling) {
        updateData.next_billing_date = new Date(
          effective.date.getTime() + 30 * 24 * 60 * 60 * 1000,
        );
      }
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: updateData,
      });
      this.logger.log(
        `Reconcile for user ${userId}: latest payment approved, subscription set to active`,
      );
    }

    this.logger.log(
      `Reconcile for user ${userId}: ${created} created, ${updated} updated, ${mpPayments.length} total`,
    );

    if (newRejected.length > 0 && sub.user) {
      try {
        const latestRej = newRejected[newRejected.length - 1];
        await this.mailService.sendPaymentRejectedEmail(
          sub.user.email,
          sub.user.name,
          `Talkion - Assinatura`,
          latestRej.amount,
          latestRej.rejection_reason,
        );
      } catch (err) {
        this.logger.warn(
          `Failed to send rejection email on reconcile: ${(err as Error).message}`,
        );
      }
    }

    return { created, updated, total: mpPayments.length };
  }

  async handlePaymentApproved(
    mpPaymentId: string,
    subscriptionId: string,
    amount: number,
    paidAt: string,
    paymentMethod: string,
  ) {
    let payment = await this.prisma.subscriptionPayment.findUnique({
      where: { mercadopago_payment_id: mpPaymentId },
    });

    const sub = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { user: true },
    });
    if (!sub) throw new NotFoundException('Assinatura não encontrada');

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: sub.plan_id },
    });
    if (!plan) throw new NotFoundException('Plano não encontrado');

    if (!payment) {
      payment = await this.prisma.subscriptionPayment.create({
        data: {
          subscription_id: subscriptionId,
          mercadopago_payment_id: mpPaymentId,
          amount,
          status: 'approved',
          payment_method: paymentMethod,
          paid_at: new Date(paidAt),
        },
      });
    }

    const creditsAlreadyApplied =
      await this.prisma.creditTransaction.findFirst({
        where: {
          user_id: sub.user_id,
          reference_type: 'subscription_payment',
          reference_id: mpPaymentId,
        },
      });

    if (!creditsAlreadyApplied) {
      await this.creditsService.resetAndAddCredits(
        sub.user_id,
        plan.credits,
        `Créditos do plano ${plan.name}`,
        'subscription_payment',
        mpPaymentId,
      );

      await this.mailService.sendPaymentApprovedEmail(
        sub.user.email,
        sub.user.name,
        plan.name,
        amount,
        plan.credits,
      );
    } else {
      this.logger.log(
        `Credits for payment ${mpPaymentId} already applied, skipping`,
      );
    }

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
        await this.mp.updateSubscriptionAmount(
          sub.mercadopago_subscription_id,
          nextAmount,
        );
        this.logger.log(
          `Preapproval ${sub.mercadopago_subscription_id} amount updated to ${nextAmount}`,
        );
      } catch (err) {
        this.logger.warn(
          `Failed to update preapproval amount: ${(err as Error).message}`,
        );
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

    return payment;
  }

  async handlePaymentRejected(
    mpPaymentId: string,
    subscriptionId: string,
    amount: number,
    statusDetail?: string,
  ) {
    const existing = await this.prisma.subscriptionPayment.findUnique({
      where: { mercadopago_payment_id: mpPaymentId },
    });
    if (existing) {
      this.logger.log(
        `Rejected payment ${mpPaymentId} already recorded, skipping`,
      );
      return existing;
    }

    const sub = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { user: true, plan: true },
    });
    if (!sub) throw new NotFoundException('Assinatura não encontrada');

    let rejectedAt: Date | null = null;
    if (mpPaymentId) {
      try {
        const mpPayment = await this.mp.getPayment(mpPaymentId);
        if (!statusDetail) {
          statusDetail = mpPayment?.status_detail || undefined;
        }
        const dateStr = mpPayment?.date_created || mpPayment?.date_approved;
        if (dateStr) rejectedAt = new Date(dateStr);
      } catch (err) {
        this.logger.warn(
          `Failed to fetch payment ${mpPaymentId} details: ${(err as Error).message}`,
        );
      }
    }

    const rejectionReason = friendlyRejectionReason(statusDetail);

    const payment = await this.prisma.subscriptionPayment.create({
      data: {
        subscription_id: subscriptionId,
        mercadopago_payment_id: mpPaymentId,
        amount,
        status: 'rejected',
        status_detail: statusDetail || null,
        rejection_reason: rejectionReason,
      },
    });

    // Se já existe um pagamento aprovado mais recente que este (ex.: o usuário
    // regularizou trocando o cartão), não rebaixa a assinatura para past_due.
    // Um webhook de recusa antigo/reenviado não deve derrubar um status ativo.
    const latestApproved = await this.prisma.subscriptionPayment.findFirst({
      where: { subscription_id: subscriptionId, status: 'approved' },
      orderBy: { paid_at: 'desc' },
    });
    const regularizedAfterRejection =
      !!rejectedAt &&
      !!latestApproved?.paid_at &&
      latestApproved.paid_at.getTime() > rejectedAt.getTime();

    if (regularizedAfterRejection) {
      this.logger.log(
        `Payment ${mpPaymentId} rejected but a newer approved payment exists, keeping subscription ${subscriptionId} active`,
      );
      return payment;
    }

    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'past_due' },
    });

    this.logger.log(
      `Payment ${mpPaymentId} rejected, subscription ${subscriptionId} past due (${rejectionReason})`,
    );

    await this.mailService.sendPaymentRejectedEmail(
      sub.user.email,
      sub.user.name,
      sub.plan.name,
      amount,
      rejectionReason,
    );

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

  async handleSubscriptionUpdated(
    mpSubscriptionId: string,
    data: { planId?: string; nextBillingDate?: string; status?: string },
  ) {
    const sub = await this.prisma.subscription.findUnique({
      where: { mercadopago_subscription_id: mpSubscriptionId },
    });
    if (!sub) throw new NotFoundException('Assinatura não encontrada');

    const updateData: any = {};
    if (data.status) updateData.status = this.mapMPStatus(data.status);
    if (data.nextBillingDate)
      updateData.next_billing_date = new Date(data.nextBillingDate);
    if (data.planId) updateData.plan_id = data.planId;

    return this.prisma.subscription.update({
      where: { id: sub.id },
      data: updateData,
    });
  }

  async findSubscriptionByMpId(mpSubscriptionId: string) {
    return this.prisma.subscription.findUnique({
      where: { mercadopago_subscription_id: mpSubscriptionId },
    });
  }

  async handleTopUpApproved(
    mpPaymentId: string,
    userId: string,
    packId: string,
  ) {
    const pack = await this.prisma.creditPack.findUnique({
      where: { id: packId },
    });
    if (!pack) {
      this.logger.warn(
        `Top-up pack not found: ${packId} for payment ${mpPaymentId}`,
      );
      return;
    }

    const existing = await this.prisma.creditTransaction.findFirst({
      where: { reference_id: mpPaymentId, reference_type: 'topup' },
    });
    if (existing) {
      this.logger.log(
        `Top-up payment ${mpPaymentId} already processed, skipping`,
      );
      return;
    }

    await this.creditsService.addCredits(
      userId,
      pack.credits,
      `Compra de ${pack.name}`,
      'topup',
      mpPaymentId,
    );

    this.logger.log(
      `Top-up approved: +${pack.credits} credits for user ${userId} (payment ${mpPaymentId})`,
    );
  }

  async handleAdditionalStudentsApproved(
    mpPaymentId: string,
    userId: string,
    subscriptionId: string,
    quantity: number,
  ) {
    const sub = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });
    if (!sub) {
      this.logger.warn(
        `Subscription not found for additional students: ${subscriptionId}`,
      );
      return;
    }

    const existing = await this.prisma.creditTransaction.findFirst({
      where: {
        reference_id: mpPaymentId,
        reference_type: 'additional_students',
      },
    });
    if (existing) {
      this.logger.log(
        `Additional students payment ${mpPaymentId} already processed, skipping`,
      );
      return;
    }

    const newAdditional = sub.additional_students + quantity;
    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { additional_students: newAdditional },
    });

    this.logger.log(
      `Additional students approved: +${quantity} for user ${userId} (payment ${mpPaymentId})`,
    );
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
