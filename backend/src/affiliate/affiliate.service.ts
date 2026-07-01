import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as crypto from 'node:crypto';

@Injectable()
export class AffiliateService {
  private readonly logger = new Logger(AffiliateService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateReferralCode(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Usuário não encontrado');

    if (user.referral_code) return user.referral_code;

    const code = this.generateCode();
    await this.prisma.user.update({
      where: { id: userId },
      data: { referral_code: code },
    });
    return code;
  }

  async getAffiliateLink(userId: string): Promise<{ code: string; link: string }> {
    const code = await this.getOrCreateReferralCode(userId);
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return {
      code,
      link: `${baseUrl}/login?ref=${code}&register=true`,
    };
  }

  async getStats(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { referral_code: true },
    });
    if (!user) throw new BadRequestException('Usuário não encontrado');

    const [commissions, referredUsers] = await Promise.all([
      this.prisma.affiliateCommission.findMany({
        where: { referrer_id: userId },
        orderBy: { created_at: 'desc' },
        take: 50,
      }),
      user.referral_code
        ? this.prisma.user.findMany({
            where: { referred_by: user.referral_code },
            select: {
              id: true,
              name: true,
              email: true,
              created_at: true,
              subscriptions: {
                select: { status: true },
                take: 1,
              },
            },
            orderBy: { created_at: 'desc' },
          })
        : Promise.resolve([]),
    ]);

    const totalEarned = commissions
      .filter((c) => c.status === 'paid')
      .reduce((sum, c) => sum + c.amount, 0);

    const pendingAmount = commissions
      .filter((c) => c.status === 'pending')
      .reduce((sum, c) => sum + c.amount, 0);

    return {
      totalReferrals: referredUsers.length,
      totalCommissions: commissions.length,
      totalEarned,
      pendingAmount,
      paidCommissions: commissions.filter((c) => c.status === 'paid'),
      pendingCommissions: commissions.filter((c) => c.status === 'pending'),
      referredUsers: referredUsers.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        created_at: u.created_at,
        hasSubscription: u.subscriptions.length > 0 && u.subscriptions.some((s) => s.status === 'active' || s.status === 'paid'),
      })),
    };
  }

  async registerReferral(referralCode: string): Promise<string | null> {
    if (!referralCode) return null;
    const referrer = await this.prisma.user.findUnique({
      where: { referral_code: referralCode },
    });
    return referrer?.referral_code || null;
  }

  async createCommission(
    referrerId: string,
    referredId: string,
    subscriptionId: string,
    amount: number,
  ) {
    const commission = await this.prisma.affiliateCommission.create({
      data: {
        referrer_id: referrerId,
        referred_id: referredId,
        subscription_id: subscriptionId,
        amount,
        status: 'pending',
      },
    });
    this.logger.log(
      `Commission created: R$${amount} for referrer ${referrerId} from referred ${referredId}`,
    );
    return commission;
  }

  private generateCode(): string {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
  }
}
