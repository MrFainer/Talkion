import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);
  private readonly from: string;

  constructor() {
    const host = process.env.SMTP_HOST || 'smtp.ethereal.email';
    const port = Number(process.env.SMTP_PORT) || 587;
    const secure = port === 465;
    this.from =
      process.env.SMTP_FROM?.trim() || '"Talkion" <noreply@talkion.com>';

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: process.env.SMTP_USER || 'ethereal.user@ethereal.email',
        pass: process.env.SMTP_PASS || 'ethereal.pass',
      },
    });
  }

  async sendVerificationEmail(to: string, token: string) {
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to,
        subject: 'Verifique seu e-mail no Talkion',
        text: `Seu código de verificação é: ${token}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h2 style="color: #3b82f6; text-align: center;">Bem-vindo ao Talkion!</h2>
            <p>Olá,</p>
            <p>Para concluir seu cadastro, por favor utilize o código de verificação abaixo na tela do sistema:</p>
            <div style="background-color: #f3f4f6; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px;">${token}</span>
            </div>
            <p>Se você não solicitou esta conta, por favor ignore este e-mail.</p>
          </div>
        `,
      });
      this.logger.log(`E-mail enviado: ${info.messageId}`);
      // Para Ethereal, podemos logar a URL de preview:
      if (info.messageId && process.env.SMTP_HOST === undefined) {
        this.logger.log(`Preview do e-mail: ${nodemailer.getTestMessageUrl(info)}`);
      }
    } catch (error) {
      this.logger.error('Erro ao enviar e-mail de verificação', error);
      // Para o MVP não quebrar se não houver SMTP configurado
      this.logger.warn(`Fallback: O código para ${to} é ${token}`);
    }
  }

  async sendPasswordResetEmail(to: string, token: string) {
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to,
        subject: 'Redefina sua senha no Talkion',
        text: `Seu código para redefinir a senha é: ${token}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h2 style="color: #2563eb; text-align: center;">Recuperação de senha</h2>
            <p>Olá,</p>
            <p>Recebemos uma solicitação para redefinir sua senha. Use o código abaixo na tela do Talkion:</p>
            <div style="background-color: #f3f4f6; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px;">${token}</span>
            </div>
            <p>Este código expira em 15 minutos.</p>
            <p>Se você não solicitou a redefinição, ignore este e-mail.</p>
          </div>
        `,
      });
      this.logger.log(`E-mail de redefinição enviado: ${info.messageId}`);
      if (info.messageId && process.env.SMTP_HOST === undefined) {
        this.logger.log(`Preview do e-mail: ${nodemailer.getTestMessageUrl(info)}`);
      }
    } catch (error) {
      this.logger.error('Erro ao enviar e-mail de redefinição', error);
      this.logger.warn(`Fallback: O código de redefinição para ${to} é ${token}`);
    }
  }
}
