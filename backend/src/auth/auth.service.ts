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
        await this.creditsService.addCredits(
          updated.id,
          TRIAL_CREDITS,
          'Créditos de boas-vindas para teste',
          'trial',
        );
        return this.generateAuthResponse(updated);
      }
      return this.generateAuthResponse(user);
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

    await this.creditsService.addCredits(
      updatedUser.id,
      TRIAL_CREDITS,
      'Créditos de boas-vindas para teste',
      'trial',
    );

    return this.generateAuthResponse(updatedUser);
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

    return this.generateAuthResponse(user);
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

  private generateAuthResponse(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        news_group_title: user.news_group_title || null,
      },
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
