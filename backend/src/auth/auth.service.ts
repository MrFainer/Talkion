import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma.service';
import { MailService } from './mail.service';
import { CreditsService } from '../credits/credits.service';
import { AffiliateService } from '../affiliate/affiliate.service';

const TRIAL_CREDITS = 500;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly creditsService: CreditsService,
    private readonly affiliateService: AffiliateService,
  ) {}

  async registerTeacher(data: any) {
    const name = (data.name || '').trim();
    const email = this.normalizeEmail(data.email);
    const password = data.password || '';
    const ref = data.ref || null;

    if (!name || !email || !password) {
      throw new BadRequestException('Nome, e-mail e senha são obrigatórios.');
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('Email já cadastrado.');
    }

    let referredBy: string | null = null;
    if (ref) {
      referredBy = await this.affiliateService.registerReferral(ref);
    }

    const password_hash = await bcrypt.hash(password, 10);
    // Gera token de 6 dígitos
    const verification_token = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();

    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        password_hash,
        role: 'TEACHER',
        email_verified: false,
        verification_token,
        active: false,
        referred_by: referredBy,
        verification_token_sent_at: new Date(),
      },
    });

    // Envia e-mail de forma assíncrona
    this.mailService
      .sendVerificationEmail(email, verification_token)
      .catch(console.error);

    return {
      message:
        'Registro realizado! Verifique seu e-mail para ativar sua conta e começar a usar o Talkion.',
      requiresVerification: true,
      email,
    };
  }

  async verifyEmail(data: { email: string; token: string }) {
    const email = this.normalizeEmail(data.email);
    const token = (data.token || '').trim();

    if (!email || !token) {
      throw new BadRequestException('E-mail e token são obrigatórios.');
    }

    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new BadRequestException('Usuário não encontrado.');
    }
    if (user.email_verified) {
      if (!user.active) {
        const updated = await this.prisma.user.update({
          where: { id: user.id },
          data: { active: true },
        });
        await this.grantWelcomeCredits(updated.id);

        await this.ensureFreeSubscription(updated.id);

        return await this.generateAuthResponse(updated);
      }
      return await this.generateAuthResponse(user);
    }
    if (user.verification_token !== token) {
      throw new BadRequestException('Token inválido ou expirado.');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        email_verified: true,
        active: true,
        verification_token: null,
        verification_token_sent_at: null,
      },
    });

    await this.grantWelcomeCredits(updatedUser.id);

    await this.ensureFreeSubscription(updatedUser.id);

    return await this.generateAuthResponse(updatedUser);
  }

  async login(data: any) {
    const email = this.normalizeEmail(data.email);
    const password = data.password || '';

    if (!email || !password) {
      throw new BadRequestException('E-mail e senha são obrigatórios.');
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    if (!user.email_verified) {
      throw new UnauthorizedException(
        'E-mail não verificado. Por favor, verifique seu e-mail.',
      );
    }

    if (!user.active) {
      throw new UnauthorizedException(
        'Sua conta está bloqueada. Entre em contato com o administrador do sistema Talkion.',
      );
    }

    return await this.generateAuthResponse(user);
  }

  async resendVerification(data: { email: string }) {
    const email = this.normalizeEmail(data.email);
    if (!email) {
      throw new BadRequestException('E-mail é obrigatório.');
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return {
        message: 'Se o e-mail estiver cadastrado, enviaremos um novo código.',
      };
    }

    if (user.email_verified) {
      return { message: 'Este e-mail já foi verificado.' };
    }

    const minSeconds = 60;
    if (user.verification_token_sent_at) {
      const diffMs =
        Date.now() - new Date(user.verification_token_sent_at).getTime();
      const remaining = Math.ceil((minSeconds * 1000 - diffMs) / 1000);
      if (remaining > 0) {
        throw new BadRequestException(
          `Aguarde ${remaining}s para reenviar o código.`,
        );
      }
    }

    const verification_token = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        verification_token,
        verification_token_sent_at: new Date(),
      },
    });

    this.mailService
      .sendVerificationEmail(email, verification_token)
      .catch(console.error);

    return { message: 'Novo código enviado para seu e-mail.' };
  }

  async requestPasswordReset(data: { email: string }) {
    const email = (data.email || '').trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('E-mail é obrigatório.');
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return {
        message:
          'Se o e-mail estiver cadastrado, enviaremos um código para redefinição.',
      };
    }

    const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
    const resetExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password_reset_token: resetToken,
        password_reset_expires_at: resetExpiresAt,
      },
    });

    this.mailService
      .sendPasswordResetEmail(email, resetToken)
      .catch(console.error);

    return {
      message:
        'Se o e-mail estiver cadastrado, enviaremos um código para redefinição.',
    };
  }

  async resetPassword(data: {
    email: string;
    token: string;
    password: string;
  }) {
    const email = (data.email || '').trim().toLowerCase();
    const token = (data.token || '').trim();
    const password = data.password || '';

    if (!email || !token || !password) {
      throw new BadRequestException(
        'E-mail, código e nova senha são obrigatórios.',
      );
    }

    if (!this.isPasswordStrong(password)) {
      throw new BadRequestException(
        'A senha deve ter pelo menos 8 caracteres, contendo maiúsculas, minúsculas, números e caracteres especiais.',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new BadRequestException('Usuário não encontrado.');
    }

    if (!user.password_reset_token || user.password_reset_token !== token) {
      throw new BadRequestException('Código de redefinição inválido.');
    }

    if (
      !user.password_reset_expires_at ||
      user.password_reset_expires_at.getTime() < Date.now()
    ) {
      throw new BadRequestException('Código de redefinição expirado.');
    }

    const password_hash = await bcrypt.hash(password, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password_hash,
        password_reset_token: null,
        password_reset_expires_at: null,
      },
    });

    return {
      message: 'Senha redefinida com sucesso.',
    };
  }

  private async grantWelcomeCredits(userId: string) {
    const freePlan = await this.prisma.subscriptionPlan.findFirst({
      where: { active: true, OR: [{ is_free: true }, { name: 'Free' }] },
      orderBy: { created_at: 'asc' },
      select: { id: true, name: true, credits: true },
    });

    if (freePlan) {
      await this.creditsService.resetAndAddCredits(
        userId,
        freePlan.credits,
        `Créditos do plano ${freePlan.name}`,
        'free_plan',
      );
      return;
    }

    await this.creditsService.addCredits(
      userId,
      TRIAL_CREDITS,
      'Créditos de boas-vindas para teste',
      'trial',
    );
  }

  private async ensureFreeSubscription(userId: string) {
    const existingSubscription = await this.prisma.subscription.findFirst({
      where: { user_id: userId, status: { in: ['active', 'pending', 'paused', 'past_due'] } },
      select: { id: true },
    });

    if (!existingSubscription) {
      const freePlan = await this.prisma.subscriptionPlan.findFirst({
        where: { active: true, OR: [{ is_free: true }, { name: 'Free' }] },
        orderBy: { created_at: 'asc' },
        select: { id: true, max_students: true },
      });

      if (freePlan) {
        await this.prisma.subscription.create({
          data: {
            user_id: userId,
            plan_id: freePlan.id,
            status: 'active',
            max_students: freePlan.max_students,
          },
        });
      }
    }
  }

  private async generateAuthResponse(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.role };

    let subscriptionStatus: string | null = null;
    let isFreePlan = false;
    let sub: {
      status: string;
      next_billing_date: Date | null;
      plan: { is_free: boolean };
    } | null = null;
    try {
      sub = await this.prisma.subscription.findFirst({
        where: { user_id: user.id },
        orderBy: { created_at: 'desc' },
        select: {
          status: true,
          next_billing_date: true,
          plan: { select: { is_free: true } },
        },
      });
      subscriptionStatus = sub?.status || null;
      isFreePlan = !sub || sub.plan?.is_free || false;
    } catch {
      subscriptionStatus = null;
    }

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        news_group_title: user.news_group_title || null,
      },
      subscription_status: subscriptionStatus,
      subscription_next_billing_date: sub?.next_billing_date || null,
      is_free_plan: isFreePlan,
    };
  }

  private isPasswordStrong(pass: string) {
    const minLength = 8;
    const hasUpper = /[A-Z]/.test(pass);
    const hasLower = /[a-z]/.test(pass);
    const hasNumber = /[0-9]/.test(pass);
    const hasSpecial = /[\W_]/.test(pass);
    return (
      pass.length >= minLength &&
      hasUpper &&
      hasLower &&
      hasNumber &&
      hasSpecial
    );
  }

  private normalizeEmail(email: string) {
    return (email || '').trim().toLowerCase();
  }
}
