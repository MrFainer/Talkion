import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(private readonly whatsappService: WhatsappService) {}

  @Get('status')
  async getStatus() {
    return this.whatsappService.getStatus();
  }

  @Get('qrcode')
  async getQrCode() {
    return this.whatsappService.getQrCode();
  }

  @Post('webhook/register')
  async registerWebhook() {
    return this.whatsappService.registerWebhook();
  }

  @Delete('logout')
  async logout() {
    return this.whatsappService.logout();
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleEvolutionWebhook(@Body() payload: any) {
    try {
      const result = await this.whatsappService.handleWebhook(payload);
      return { status: 'success', result };
    } catch (error) {
      this.logger.error('Erro ao processar webhook', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  }

  @Post('test-send')
  @HttpCode(HttpStatus.OK)
  async testSendMessage(@Body() body: { number: string; text: string }) {
    await this.whatsappService.sendMessage(body.number, body.text);
    return { message: 'Requisição de envio processada!' };
  }

  @Post('send-latest-news-quiz')
  @HttpCode(HttpStatus.OK)
  async sendLatestNewsAndQuiz(
    @Body() body: { number: string; mode?: 'PRIVATE' | 'GROUP' },
  ) {
    const result = await this.whatsappService.sendLatestNewsAndQuiz(body.number, {
      forceTargetType: body.mode,
    });
    return { message: 'Fluxo diário enviado com sucesso!', result };
  }
}
