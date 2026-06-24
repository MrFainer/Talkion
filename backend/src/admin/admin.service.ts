import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreditsService } from '../credits/credits.service';
import { MercadoPagoService } from '../subscriptions/mercadopago.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly creditsService: CreditsService,
    private readonly mpService: MercadoPagoService,
  ) {}

  async listTeachers(fromStr?: string, toStr?: string) {
    let fromDate: Date;
    let toDate: Date;

    const now = new Date();
    if (fromStr) {
      fromDate = new Date(fromStr);
    } else {
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1); // 1st day of current month
    }

    if (toStr) {
      toDate = new Date(toStr);
      toDate.setHours(23, 59, 59, 999);
    } else {
      toDate = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      ); // last day of current month
    }

    const teachers = await this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        credit_balance: true,
        created_at: true,
        subscriptions: {
          where: { status: { in: ['active', 'pending'] } },
          select: {
            id: true,
            status: true,
            plan_id: true,
            plan: {
              select: {
                id: true,
                name: true,
                price: true,
                credits: true,
                max_students: true,
              },
            },
            additional_students: true,
            max_students: true,
          },
          take: 1,
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const teacherIds: string[] = teachers.map((t: { id: string }) => t.id);
    const costs = await this.prisma.usageCostEvent.groupBy({
      by: ['teacher_id'],
      where: {
        teacher_id: { in: teacherIds },
        created_at: {
          gte: fromDate,
          lte: toDate,
        },
      },
      _sum: {
        total_tokens: true,
        input_tokens: true,
        output_tokens: true,
        cached_input_tokens: true,
        audio_seconds: true,
      },
    });

    const ttsCosts = await this.prisma.usageCostEvent.groupBy({
      by: ['teacher_id'],
      where: {
        teacher_id: { in: teacherIds },
        action: 'NEWS_TTS_GENERATION',
        created_at: {
          gte: fromDate,
          lte: toDate,
        },
      },
      _sum: {
        quantity: true,
      },
    });

    type CostRow = {
      teacher_id: string;
      _sum: {
        total_tokens: number | null;
        input_tokens: number | null;
        output_tokens: number | null;
        cached_input_tokens: number | null;
        audio_seconds: number | null;
      };
    };
    type TtsRow = { teacher_id: string; _sum: { quantity: number | null } };
    type TeacherRow = {
      id: string;
      name: string;
      email: string;
      role: string;
      active: boolean;
      credit_balance: number;
      created_at: Date;
      subscriptions: Array<{
        id: string;
        status: string;
        plan_id: string | null;
        plan: {
          id: string;
          name: string;
          price: number;
          credits: number;
          max_students: number;
        } | null;
        additional_students: number;
        max_students: number;
      }>;
    };

    const costMap = new Map<string, CostRow['_sum']>(
      (costs as CostRow[]).map((c) => [c.teacher_id, c._sum]),
    );
    const ttsMap = new Map<string, TtsRow['_sum']>(
      (ttsCosts as TtsRow[]).map((c) => [c.teacher_id, c._sum]),
    );

    return {
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      data: (teachers as TeacherRow[]).map((teacher) => {
        const stats = costMap.get(teacher.id) || {
          total_tokens: 0,
          input_tokens: 0,
          output_tokens: 0,
          cached_input_tokens: 0,
          audio_seconds: 0,
        };
        const ttsStats = ttsMap.get(teacher.id) || { quantity: 0 };
        const sub = teacher.subscriptions?.[0];
        return {
          id: teacher.id,
          name: teacher.name,
          email: teacher.email,
          role: teacher.role,
          active: teacher.active,
          credit_balance: teacher.credit_balance,
          created_at: teacher.created_at,
          totalTokens: stats.total_tokens || 0,
          inputTokens: stats.input_tokens || 0,
          outputTokens: stats.output_tokens || 0,
          cachedTokens: stats.cached_input_tokens || 0,
          audioSeconds: stats.audio_seconds || 0,
          ttsCharacters: ttsStats.quantity || 0,
          creditBalance: teacher.credit_balance || 0,
          subscription: sub
            ? {
                id: sub.id,
                status: sub.status,
                planId: sub.plan_id,
                planName: sub.plan?.name || null,
                planCredits: sub.plan?.credits || 0,
                planPrice: sub.plan?.price || 0,
                planMaxStudents: sub.plan?.max_students || 0,
                additionalStudents: sub.additional_students,
                maxStudents: sub.max_students,
              }
            : null,
        };
      }),
    };
  }

  async toggleTeacherStatus(teacherId: string) {
    const teacher = await this.prisma.user.findUnique({
      where: { id: teacherId },
    });
    if (!teacher) {
      throw new NotFoundException('Professor não encontrado.');
    }

    const updated = await this.prisma.user.update({
      where: { id: teacherId },
      data: { active: !teacher.active },
      select: {
        id: true,
        name: true,
        active: true,
      },
    });

    return updated;
  }

  async updateTeacherPlan(teacherId: string, newPlanId: string) {
    const teacher = await this.prisma.user.findUnique({
      where: { id: teacherId },
    });
    if (!teacher) {
      throw new NotFoundException('Professor não encontrado.');
    }

    const newPlan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: newPlanId },
    });
    if (!newPlan || !newPlan.active) {
      throw new NotFoundException('Plano não encontrado ou inativo.');
    }

    const currentStudents = await this.prisma.student.count({
      where: { teacher_id: teacherId },
    });
    const extraStudents = Math.max(0, currentStudents - newPlan.max_students);

    // Check if teacher already has an active/pending subscription
    const existingSub = await this.prisma.subscription.findFirst({
      where: { user_id: teacherId, status: { in: ['active', 'pending'] } },
    });

    if (existingSub) {
      // Cancel old MP subscription if it exists
      if (existingSub.mercadopago_subscription_id) {
        try {
          await this.mpService.cancelSubscription(
            existingSub.mercadopago_subscription_id,
          );
          this.logger.log(
            `Cancelled MP subscription ${existingSub.mercadopago_subscription_id} for teacher ${teacherId}`,
          );
        } catch (err) {
          this.logger.warn(
            `Failed to cancel MP subscription: ${(err as Error).message}`,
          );
        }
      }

      // Update existing subscription
      await this.prisma.subscription.update({
        where: { id: existingSub.id },
        data: {
          plan_id: newPlanId,
          max_students: newPlan.max_students,
          additional_students: extraStudents,
          status: 'active',
        },
      });

      this.logger.log(
        `Plan updated for teacher ${teacherId}: ${existingSub.plan_id} -> ${newPlanId}`,
      );
    } else {
      // Create new subscription
      await this.prisma.subscription.create({
        data: {
          user_id: teacherId,
          plan_id: newPlanId,
          status: 'active',
          max_students: newPlan.max_students,
          additional_students: extraStudents,
          payment_method: 'admin_assignment',
        },
      });

      this.logger.log(
        `Subscription created for teacher ${teacherId} with plan ${newPlanId} (admin assignment)`,
      );
    }

    // Reset credits to the plan's credit amount
    await this.creditsService.resetAndAddCredits(
      teacherId,
      newPlan.credits,
      `Créditos do plano ${newPlan.name} (admin)`,
      'admin_plan_change',
      `plan_${newPlanId}_${Date.now()}`,
    );

    return {
      teacherId,
      planId: newPlanId,
      planName: newPlan.name,
      credits: newPlan.credits,
      maxStudents: newPlan.max_students,
      additionalStudents: extraStudents,
    };
  }

  async updateTeacherCredits(
    teacherId: string,
    amount: number,
    mode: 'set' | 'add' = 'set',
    description?: string,
  ) {
    const teacher = await this.prisma.user.findUnique({
      where: { id: teacherId },
    });
    if (!teacher) {
      throw new NotFoundException('Professor não encontrado.');
    }

    if (mode === 'add') {
      if (amount <= 0)
        throw new BadRequestException(
          'Quantidade deve ser positiva para adição',
        );
      return this.creditsService.addCredits(
        teacherId,
        amount,
        description || 'Créditos adicionados (admin)',
        'admin_adjustment',
      );
    }

    // mode === 'set' — reset to absolute value
    return this.creditsService.resetAndAddCredits(
      teacherId,
      amount,
      description || `Créditos definidos para ${amount} (admin)`,
      'admin_adjustment',
    );
  }
}
