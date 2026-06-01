import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { MailService } from '../auth/mail.service';

@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async getCost(actionKey: string): Promise<number> {
    const config = await this.prisma.creditActionConfig.findUnique({
      where: { key: actionKey },
    });
    return config?.current_cost ?? 0;
  }

  async getAllCosts() {
    return this.prisma.creditActionConfig.findMany({
      where: { category: { notIn: ['admin', 'whatsapp'] } },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async updateCost(key: string, current_cost: number) {
    const config = await this.prisma.creditActionConfig.findUnique({ where: { key } });
    if (!config) throw new NotFoundException(`Configuração de crédito não encontrada: ${key}`);
    if (current_cost < 0) throw new BadRequestException('O custo não pode ser negativo');
    return this.prisma.creditActionConfig.update({
      where: { key },
      data: { current_cost },
    });
  }

  async getBalance(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { credit_balance: true },
    });
    return Math.floor(user?.credit_balance ?? 0);
  }

  async checkBalance(userId: string, actionKey: string): Promise<{ sufficient: boolean; cost: number; balance: number }> {
    const cost = await this.getCost(actionKey);
    const balance = await this.getBalance(userId);
    return { sufficient: balance >= cost, cost, balance };
  }

  async deductCredits(
    userId: string,
    actionKey: string,
    referenceType?: string,
    referenceId?: string,
  ): Promise<{ deducted: boolean; balance: number; cost: number }> {
    if (!userId) return { deducted: false, balance: 0, cost: 0 };

    const cost = await this.getCost(actionKey);
    if (cost <= 0) return { deducted: true, balance: await this.getBalance(userId), cost: 0 };

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const currentBalance = Math.floor(user.credit_balance);
    if (currentBalance < cost) {
      this.logger.warn(`Créditos insuficientes para ${userId}: tem ${currentBalance}, precisa ${cost}`);
      return { deducted: false, balance: currentBalance, cost };
    }

    const newBalance = currentBalance - cost;

    const config = await this.prisma.creditActionConfig.findUnique({ where: { key: actionKey } });

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { credit_balance: newBalance },
      }),
      this.prisma.creditTransaction.create({
        data: {
          user_id: userId,
          type: 'DEBIT',
          amount: cost,
          balance_after: newBalance,
          description: config?.name || actionKey,
          action_key: actionKey,
          reference_type: referenceType,
          reference_id: referenceId,
        },
      }),
    ]);

    this.logger.log(`Créditos debitados: ${userId} - ${cost} (${actionKey}) - saldo: ${newBalance}`);

    await this.checkAndNotifyLowCredits(userId, newBalance);

    return { deducted: true, balance: newBalance, cost };
  }

  async resetAndAddCredits(
    userId: string,
    amount: number,
    description: string,
    referenceType?: string,
    referenceId?: string,
  ) {
    if (amount <= 0) throw new BadRequestException('Quantidade deve ser positiva');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const newBalance = amount;

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { credit_balance: newBalance },
      }),
      this.prisma.creditTransaction.create({
        data: {
          user_id: userId,
          type: 'CREDIT',
          amount,
          balance_after: newBalance,
          description,
          reference_type: referenceType,
          reference_id: referenceId,
        },
      }),
    ]);

    this.logger.log(`Créditos resetados: ${userId} = ${amount} - saldo: ${newBalance}`);
    return { balance: newBalance };
  }

  async addCredits(
    userId: string,
    amount: number,
    description: string,
    referenceType?: string,
    referenceId?: string,
  ) {
    if (amount <= 0) throw new BadRequestException('Quantidade deve ser positiva');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const currentBalance = Math.floor(user.credit_balance);
    const newBalance = currentBalance + amount;

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { credit_balance: newBalance },
      }),
      this.prisma.creditTransaction.create({
        data: {
          user_id: userId,
          type: 'CREDIT',
          amount,
          balance_after: newBalance,
          description,
          reference_type: referenceType,
          reference_id: referenceId,
        },
      }),
    ]);

    this.logger.log(`Créditos adicionados: ${userId} +${amount} - saldo: ${newBalance}`);
    return { balance: newBalance };
  }

  async getTransactions(userId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.creditTransaction.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.creditTransaction.count({ where: { user_id: userId } }),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async checkAndNotifyLowCredits(userId: string, balance?: number) {
    const currentBalance = balance ?? await this.getBalance(userId);
    const configs = await this.prisma.creditActionConfig.findMany({
      where: { current_cost: { gt: 0 } },
      orderBy: { current_cost: 'asc' },
      take: 1,
    });

    const lowestCost = configs[0]?.current_cost ?? 5;
    const threshold = Math.max(lowestCost * 10, 200);

    if (currentBalance > 0 && currentBalance <= threshold) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });
      if (user?.email) {
        await this.mailService.sendLowCreditsEmail(user.email, user.name, currentBalance);
      }
    }
  }
}
