import { Controller, Post, Body, HttpCode, HttpStatus, Logger, Param } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(private readonly whatsappService: WhatsappService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleEvolutionWebhook(@Body() payload: any) {
    // A Evolution API envia eventos para esta rota
    try {
      await this.whatsappService.handleWebhook(payload);
      return { status: 'success' };
    } catch (error) {
      this.logger.error('Erro ao processar webhook', error);
      // Retornamos 200 mesmo com erro para a Evolution API não ficar repetindo a requisição em loop infinito
      return { status: 'error', message: error.message }; 
    }
  }

  // Rota de teste para enviar mensagem
  @Post('test-send')
  @HttpCode(HttpStatus.OK)
  async testSendMessage(@Body() body: { number: string; text: string }) {
    await this.whatsappService.sendMessage(body.number, body.text);
    return { message: 'Requisição de envio processada!' };
  }
}
