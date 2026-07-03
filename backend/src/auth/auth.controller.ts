import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import axios from 'axios';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  private readonly turnstileSecret: string;

  constructor(private readonly authService: AuthService) {
    this.turnstileSecret = process.env.TURNSTILE_SECRET_KEY || '';
  }

  @Post('register')
  async register(
    @Body() body: any,
    @Req() req: Request,
  ) {
    if (this.turnstileSecret) {
      const ip =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.ip ||
        'unknown';
      const turnstileToken = (body?.turnstileToken || '').trim();

      if (!turnstileToken) {
        throw new HttpException(
          'Verifique o Captcha antes de continuar.',
          HttpStatus.BAD_REQUEST,
        );
      }

      try {
        const verify = await axios.post(
          'https://challenges.cloudflare.com/turnstile/v0/siteverify',
          new URLSearchParams({
            secret: this.turnstileSecret,
            response: turnstileToken,
            remoteip: ip,
          }),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
        );

        if (!verify.data?.success) {
          this.logger.warn(
            `Turnstile inválido no cadastro de ${body?.email || 'sem-email'} (IP: ${ip})`,
          );
          throw new HttpException(
            'Verificação anti-bot falhou. Tente novamente.',
            HttpStatus.FORBIDDEN,
          );
        }
      } catch (error: any) {
        if (error instanceof HttpException) throw error;
        this.logger.error(`Erro ao validar Turnstile no cadastro: ${error}`);
        throw new HttpException(
          'Erro na verificação de segurança.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }

    return this.authService.registerTeacher(body);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() body: { email: string; token: string }) {
    return this.authService.verifyEmail(body);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body() body: { email: string }) {
    return this.authService.resendVerification(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: any) {
    return this.authService.login(body);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() body: { email: string }) {
    return this.authService.requestPasswordReset(body);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() body: { email: string; token: string; password: string },
  ) {
    return this.authService.resetPassword(body);
  }
}
