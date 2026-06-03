import {
  Controller,
  Post,
  Body,
  Logger,
  HttpException,
  HttpStatus,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import axios from 'axios';
import { MailService } from '../auth/mail.service';

@Controller('contact')
export class ContactController {
  private readonly logger = new Logger(ContactController.name);
  private readonly requestLog = new Map<string, number[]>();
  private readonly turnstileSecret: string;

  constructor(private readonly mailService: MailService) {
    this.turnstileSecret =
      process.env.TURNSTILE_SECRET_KEY || '';
  }

  @Post()
  async sendContact(
    @Body() body: { nome: string; email: string; mensagem: string; turnstileToken?: string },
    @Req() req: Request,
  ) {
    const { nome, email, mensagem, turnstileToken } = body;

    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      'unknown';

    const now = Date.now();
    const timestamps = this.requestLog.get(ip) || [];
    const recent = timestamps.filter((t) => now - t < 60000);
    if (recent.length >= 3) {
      this.logger.warn(`Rate limit excedido para ${ip}`);
      throw new HttpException(
        'Muitas tentativas. Aguarde um minuto.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.requestLog.set(ip, recent);

    if (this.turnstileSecret) {
      if (!turnstileToken) {
        throw new HttpException('Token Turnstile ausente.', HttpStatus.BAD_REQUEST);
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
          this.logger.warn(`Turnstile inválido para ${email} (IP: ${ip})`);
          throw new HttpException(
            'Verificação anti-bot falhou. Tente novamente.',
            HttpStatus.FORBIDDEN,
          );
        }
      } catch (error: any) {
        if (error instanceof HttpException) throw error;
        this.logger.error(`Erro ao validar Turnstile: ${error}`);
        throw new HttpException(
          'Erro na verificação de segurança.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }

    try {
      await this.mailService.sendContactEmail(nome, email, mensagem);
      this.logger.log(`Contato enviado por ${email} (IP: ${ip})`);
      return { success: true, message: 'Mensagem enviada com sucesso!' };
    } catch (error) {
      this.logger.error(`Erro ao enviar contato: ${error}`);
      return {
        success: false,
        message: 'Erro ao enviar mensagem. Tente novamente mais tarde.',
      };
    }
  }
}
