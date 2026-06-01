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

  async sendLowCreditsEmail(to: string, name: string, balance: number) {
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to,
        subject: '⚠️ Créditos baixos - Talkion',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h2 style="color: #f59e0b; text-align: center;">Créditos Baixos</h2>
            <p>Olá ${name},</p>
            <p>Seus créditos no Talkion estão acabando!</p>
            <div style="background-color: #fef3c7; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; color: #92400e;">${Math.floor(balance)}</span>
              <p style="color: #92400e; margin: 5px 0 0;">créditos restantes</p>
            </div>
            <p>Recomendamos que você adquira mais créditos ou um plano com mais créditos mensais para continuar usando a plataforma sem interrupções.</p>
            <p style="text-align: center; margin-top: 20px;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/subscriptions" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Adquirir Créditos</a>
            </p>
          </div>
        `,
      });
      this.logger.log(`E-mail de créditos baixos enviado: ${info.messageId}`);
    } catch (error) {
      this.logger.error('Erro ao enviar e-mail de créditos baixos', error);
    }
  }

  async sendInsufficientCreditsEmail(to: string, name: string, balance: number, cost: number, actionName: string) {
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to,
        subject: '⛔ Créditos insuficientes - Talkion',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h2 style="color: #ef4444; text-align: center;">Ação bloqueada por créditos insuficientes</h2>
            <p>Olá ${name},</p>
            <p>A ação <strong>${actionName}</strong> não foi realizada porque sua conta não tem créditos suficientes.</p>
            <div style="background-color: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Saldo atual:</strong> ${Math.floor(balance)} créditos</p>
              <p style="margin: 5px 0;"><strong>Custo da ação:</strong> ${cost} créditos</p>
            </div>
            <p>Adquira mais créditos ou contrate um plano para continuar usando a plataforma.</p>
            <p style="text-align: center; margin-top: 20px;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/subscriptions" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Adquirir Créditos</a>
            </p>
          </div>
        `,
      });
      this.logger.log(`E-mail de créditos insuficientes enviado: ${info.messageId}`);
    } catch (error) {
      this.logger.error('Erro ao enviar e-mail de créditos insuficientes', error);
    }
  }

  async sendPaymentApprovedEmail(to: string, name: string, planName: string, amount: number, credits: number) {
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to,
        subject: '✅ Pagamento aprovado - Talkion',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h2 style="color: #10b981; text-align: center;">Pagamento Aprovado!</h2>
            <p>Olá ${name},</p>
            <p>Seu pagamento foi aprovado com sucesso!</p>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Plano:</strong> ${planName}</p>
              <p style="margin: 5px 0;"><strong>Valor:</strong> R$ ${amount.toFixed(2)}</p>
              <p style="margin: 5px 0;"><strong>Créditos recebidos:</strong> ${credits.toLocaleString('pt-BR')}</p>
            </div>
            <p>Seus créditos já estão disponíveis na sua conta. Aproveite!</p>
          </div>
        `,
      });
      this.logger.log(`E-mail de pagamento aprovado enviado: ${info.messageId}`);
    } catch (error) {
      this.logger.error('Erro ao enviar e-mail de pagamento aprovado', error);
    }
  }

  async sendPaymentRejectedEmail(to: string, name: string, planName: string, amount: number) {
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to,
        subject: '❌ Pagamento recusado - Talkion',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h2 style="color: #ef4444; text-align: center;">Pagamento Recusado</h2>
            <p>Olá ${name},</p>
            <p>Infelizmente seu pagamento do plano <strong>${planName}</strong> no valor de <strong>R$ ${amount.toFixed(2)}</strong> foi recusado.</p>
            <p>Possíveis motivos:</p>
            <ul>
              <li>Saldo insuficiente</li>
              <li>Cartão bloqueado</li>
              <li>Dados incorretos</li>
            </ul>
            <p style="text-align: center; margin-top: 20px;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/subscriptions/checkout" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Tentar Novamente</a>
            </p>
            <p>Verifique seus dados e tente novamente. Se o problema persistir, entre em contato com seu banco.</p>
          </div>
        `,
      });
      this.logger.log(`E-mail de pagamento recusado enviado: ${info.messageId}`);
    } catch (error) {
      this.logger.error('Erro ao enviar e-mail de pagamento recusado', error);
    }
  }
}
