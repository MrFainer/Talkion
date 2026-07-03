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

  async listAffiliates() {
    const frontendUrl = (
      process.env.FRONTEND_URL || 'http://localhost:3000'
    ).replace(/\/+$/, '');

    const affiliates = await this.prisma.user.findMany({
      where: {
        role: 'TEACHER',
        OR: [
          { referral_code: { not: null } },
          { referredUsers: { some: {} } },
          { affiliateCommissions: { some: {} } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        referral_code: true,
        created_at: true,
        referredUsers: {
          orderBy: { created_at: 'desc' },
          select: {
            id: true,
            name: true,
            email: true,
            referred_by: true,
            created_at: true,
            subscriptions: {
              orderBy: { created_at: 'desc' },
              take: 1,
              select: {
                id: true,
                status: true,
                created_at: true,
                plan: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
        affiliateCommissions: {
          orderBy: { created_at: 'desc' },
          select: {
            id: true,
            referred_id: true,
            amount: true,
            status: true,
            created_at: true,
            paid_at: true,
            subscription_id: true,
          },
        },
      },
      orderBy: [{ created_at: 'desc' }],
    });

    const data = affiliates.map((affiliate) => {
      const commissionMap = new Map<
        string,
        {
          id: string;
          referred_id: string;
          amount: number;
          status: string;
          created_at: Date;
          paid_at: Date | null;
          subscription_id: string | null;
        }
      >(
        affiliate.affiliateCommissions.map((commission) => [
          commission.referred_id,
          commission,
        ]),
      );

      const referrals = affiliate.referredUsers.map((referredUser) => {
        const latestSubscription = referredUser.subscriptions[0] || null;
        const commission = commissionMap.get(referredUser.id) || null;

        return {
          id: referredUser.id,
          name: referredUser.name,
          email: referredUser.email,
          created_at: referredUser.created_at,
          referred_by: referredUser.referred_by,
          source_type: 'codigo',
          subscription: latestSubscription
            ? {
                id: latestSubscription.id,
                status: latestSubscription.status,
                created_at: latestSubscription.created_at,
                plan_name: latestSubscription.plan?.name || null,
              }
            : null,
          commission: commission
            ? {
                id: commission.id,
                amount: commission.amount,
                status: commission.status,
                created_at: commission.created_at,
                paid_at: commission.paid_at,
                subscription_id: commission.subscription_id,
              }
            : null,
        };
      });

      const totalReferrals = referrals.length;
      const convertedReferrals = referrals.filter((item) => item.subscription)
        .length;
      const pendingCommissions = affiliate.affiliateCommissions
        .filter((item) => item.status === 'pending')
        .reduce((sum, item) => sum + item.amount, 0);
      const paidCommissions = affiliate.affiliateCommissions
        .filter((item) => item.status === 'paid')
        .reduce((sum, item) => sum + item.amount, 0);

      return {
        id: affiliate.id,
        name: affiliate.name,
        email: affiliate.email,
        created_at: affiliate.created_at,
        referral_code: affiliate.referral_code,
        referral_link: affiliate.referral_code
          ? `${frontendUrl}/login?ref=${affiliate.referral_code}&register=true`
          : null,
        total_referrals: totalReferrals,
        converted_referrals: convertedReferrals,
        pending_commissions: pendingCommissions,
        paid_commissions: paidCommissions,
        total_commissions:
          pendingCommissions + paidCommissions,
        referrals,
      };
    });

    const totalAffiliates = data.length;
    const totalReferrals = data.reduce(
      (sum, affiliate) => sum + affiliate.total_referrals,
      0,
    );
    const convertedReferrals = data.reduce(
      (sum, affiliate) => sum + affiliate.converted_referrals,
      0,
    );
    const pendingCommissions = data.reduce(
      (sum, affiliate) => sum + affiliate.pending_commissions,
      0,
    );
    const paidCommissions = data.reduce(
      (sum, affiliate) => sum + affiliate.paid_commissions,
      0,
    );

    return {
      overview: {
        total_affiliates: totalAffiliates,
        affiliates_with_referrals: data.filter(
          (affiliate) => affiliate.total_referrals > 0,
        ).length,
        total_referrals: totalReferrals,
        converted_referrals: convertedReferrals,
        pending_commissions: pendingCommissions,
        paid_commissions: paidCommissions,
        conversion_rate:
          totalReferrals > 0 ? convertedReferrals / totalReferrals : 0,
      },
      data,
    };
  }

  async listSiteVisits(from?: string, to?: string) {
    const where: any = {};
    const createdAtFilter: Record<string, Date> = {};

    if (from) {
      const fromDate = new Date(from);
      if (!Number.isNaN(fromDate.getTime())) {
        createdAtFilter.gte = fromDate;
      }
    }

    if (to) {
      const toDate = new Date(to);
      if (!Number.isNaN(toDate.getTime())) {
        createdAtFilter.lte = toDate;
      }
    }

    if (Object.keys(createdAtFilter).length > 0) {
      where.created_at = createdAtFilter;
    }

    const visits = await this.prisma.siteVisit.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 300,
      select: {
        id: true,
        page_type: true,
        source_type: true,
        path: true,
        full_url: true,
        referral_code: true,
        referrer_url: true,
        referer_header: true,
        ip_address: true,
        user_agent: true,
        browser_name: true,
        os_name: true,
        device_type: true,
        device_vendor: true,
        device_model: true,
        platform: true,
        language: true,
        screen_width: true,
        screen_height: true,
        timezone: true,
        created_at: true,
      },
    });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const overview = {
      total_visits: visits.length,
      visits_today: visits.filter((visit) => visit.created_at >= startOfToday)
        .length,
      home_visits: visits.filter((visit) => visit.page_type === 'HOME').length,
      login_visits: visits.filter((visit) => visit.page_type === 'LOGIN')
        .length,
      register_visits: visits.filter(
        (visit) => visit.page_type === 'REGISTER',
      ).length,
      referral_visits: visits.filter(
        (visit) => visit.source_type === 'REFERRAL_LINK',
      ).length,
      direct_visits: visits.filter((visit) => visit.source_type === 'DIRECT')
        .length,
    };

    return {
      overview,
      period: {
        from: createdAtFilter.gte?.toISOString() || null,
        to: createdAtFilter.lte?.toISOString() || null,
      },
      data: visits.map((visit) => ({
        id: visit.id,
        page_type: visit.page_type,
        source_type: visit.source_type,
        path: visit.path,
        full_url: visit.full_url,
        referral_code: visit.referral_code,
        referrer_url: visit.referrer_url,
        referer_header: visit.referer_header,
        ip_address: visit.ip_address,
        user_agent: visit.user_agent,
        browser_name: visit.browser_name,
        os_name: visit.os_name,
        device_type: visit.device_type,
        device_vendor: visit.device_vendor,
        device_model: visit.device_model,
        platform: visit.platform,
        language: visit.language,
        screen_width: visit.screen_width,
        screen_height: visit.screen_height,
        timezone: visit.timezone,
        created_at: visit.created_at,
      })),
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

  async deleteUser(userId: string, requesterId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        referral_code: true,
        subscriptions: {
          select: {
            mercadopago_subscription_id: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    if (requesterId && requesterId === userId) {
      throw new BadRequestException(
        'Você não pode excluir o seu próprio usuário.',
      );
    }

    const subscriptionIds = user.subscriptions
      .map((subscription) => subscription.mercadopago_subscription_id)
      .filter(Boolean) as string[];

    for (const subscriptionId of subscriptionIds) {
      try {
        await this.mpService.cancelSubscription(subscriptionId);
      } catch (error) {
        this.logger.warn(
          `Falha ao cancelar assinatura Mercado Pago ${subscriptionId}: ${(error as Error).message}`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const studentIds = Array.from(
        new Set(
          (
            await tx.student.findMany({
              where: {
                OR: [{ user_id: userId }, { teacher_id: userId }],
              },
              select: { id: true },
            })
          ).map((student) => student.id),
        ),
      );

      const newsIds = (
        await tx.news.findMany({
          where: { teacher_id: userId },
          select: { id: true },
        })
      ).map((news) => news.id);

      const quizFilters: Array<Record<string, unknown>> = [
        { teacher_id: userId },
      ];
      if (newsIds.length > 0) {
        quizFilters.push({ news_id: { in: newsIds } });
      }

      const quizIds = Array.from(
        new Set(
          (
            await tx.quiz.findMany({
              where: { OR: quizFilters },
              select: { id: true },
            })
          ).map((quiz) => quiz.id),
        ),
      );

      const audioSubmissionFilters: Array<Record<string, unknown>> = [];
      if (studentIds.length > 0) {
        audioSubmissionFilters.push({ student_id: { in: studentIds } });
      }
      if (newsIds.length > 0) {
        audioSubmissionFilters.push({ news_id: { in: newsIds } });
      }

      const audioSubmissionIds =
        audioSubmissionFilters.length > 0
          ? (
              await tx.audioSubmission.findMany({
                where: { OR: audioSubmissionFilters },
                select: { id: true },
              })
            ).map((submission) => submission.id)
          : [];

      if (user.referral_code) {
        await tx.user.updateMany({
          where: { referred_by: user.referral_code },
          data: { referred_by: null },
        });
      }

      await tx.affiliateCommission.deleteMany({
        where: {
          OR: [{ referrer_id: userId }, { referred_id: userId }],
        },
      });

      if (quizIds.length > 0) {
        await tx.quizAnswer.deleteMany({
          where: {
            OR: [{ quiz_id: { in: quizIds } }],
          },
        });
      }

      if (audioSubmissionIds.length > 0) {
        await tx.speakingFeedback.deleteMany({
          where: { audio_submission_id: { in: audioSubmissionIds } },
        });
        await tx.audioSubmission.deleteMany({
          where: { id: { in: audioSubmissionIds } },
        });
      }

      if (quizIds.length > 0) {
        await tx.quiz.deleteMany({
          where: { id: { in: quizIds } },
        });
      }

      if (newsIds.length > 0) {
        await tx.news.deleteMany({
          where: { id: { in: newsIds } },
        });
      }

      if (studentIds.length > 0) {
        await tx.student.deleteMany({
          where: { id: { in: studentIds } },
        });
      }

      await tx.whatsappGroup.deleteMany({
        where: { teacher_id: userId },
      });

      await tx.usageCostEvent.deleteMany({
        where: { teacher_id: userId },
      });

      await tx.content.deleteMany({
        where: { teacher_id: userId },
      });

      await tx.messageSettingsHistory.deleteMany({
        where: { teacher_id: userId },
      });

      await tx.messageSettings.deleteMany({
        where: { teacher_id: userId },
      });

      await tx.subscription.deleteMany({
        where: { user_id: userId },
      });

      await tx.creditTransaction.deleteMany({
        where: { user_id: userId },
      });

      await tx.user.delete({
        where: { id: userId },
      });
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      deleted: true,
    };
  }
}
