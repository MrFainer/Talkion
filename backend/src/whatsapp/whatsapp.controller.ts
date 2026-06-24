import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(private readonly whatsappService: WhatsappService) {}

  @Get('status/:teacherId')
  async getStatus(@Param('teacherId') teacherId: string) {
    if (!teacherId) throw new BadRequestException('teacherId is required');
    return this.whatsappService.getStatus(teacherId);
  }

  @Get('sync-status/:teacherId')
  async getSyncStatus(@Param('teacherId') teacherId: string) {
    if (!teacherId) {
      throw new BadRequestException('teacherId is required');
    }

    return this.whatsappService.getSyncStatus(teacherId);
  }

  @Post('sync/:teacherId')
  async triggerSync(@Param('teacherId') teacherId: string) {
    if (!teacherId) {
      throw new BadRequestException('teacherId is required');
    }

    return this.whatsappService.triggerSync(teacherId);
  }

  @Get('qrcode/:teacherId')
  async getQrCode(@Param('teacherId') teacherId: string) {
    if (!teacherId) throw new BadRequestException('teacherId is required');
    return this.whatsappService.getQrCode(teacherId);
  }

  @Post('webhook/register')
  async registerWebhook(@Body() body: { teacherId: string }) {
    if (!body.teacherId) throw new BadRequestException('teacherId is required');
    return this.whatsappService.registerWebhook(body.teacherId);
  }

  @Delete('logout/:teacherId')
  async logout(@Param('teacherId') teacherId: string) {
    if (!teacherId) throw new BadRequestException('teacherId is required');
    return this.whatsappService.logout(teacherId);
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

  @Post('broadcast-private')
  async broadcastPrivate(@Body() body: { teacherId: string }) {
    if (!body.teacherId) throw new BadRequestException('teacherId is required');
    return this.whatsappService.broadcastPrivate(body.teacherId);
  }

  @Get('groups/:teacherId')
  async listGroups(@Param('teacherId') teacherId: string) {
    if (!teacherId) {
      throw new BadRequestException('teacherId is required');
    }

    return this.whatsappService.listGroups(teacherId);
  }

  @Get('groups/cached/:teacherId')
  async listStoredGroups(@Param('teacherId') teacherId: string) {
    if (!teacherId) {
      throw new BadRequestException('teacherId is required');
    }

    return this.whatsappService.listStoredGroups(teacherId);
  }

  @Post('groups/validate-title')
  async validateGroupTitle(@Body() body: { teacherId: string; title: string }) {
    if (!body.teacherId) {
      throw new BadRequestException('teacherId is required');
    }

    if (!body.title) {
      throw new BadRequestException('title is required');
    }

    return this.whatsappService.validateGroupTitle(body.teacherId, body.title);
  }

  @Get('groups/news-target/:teacherId')
  async getConfiguredNewsGroup(@Param('teacherId') teacherId: string) {
    if (!teacherId) {
      throw new BadRequestException('teacherId is required');
    }

    return this.whatsappService.getConfiguredNewsGroup(teacherId);
  }

  @Get('groups/settings/:teacherId')
  async getNewsGroupSettings(
    @Param('teacherId') teacherId: string,
    @Query('title') title?: string,
  ) {
    if (!teacherId) {
      throw new BadRequestException('teacherId is required');
    }

    return this.whatsappService.getNewsGroupSettings(teacherId, title);
  }

  @Patch('groups/settings')
  async updateNewsGroupSettings(
    @Body() body: { teacherId: string; title: string },
  ) {
    if (!body.teacherId) {
      throw new BadRequestException('teacherId is required');
    }

    if (!body.title) {
      throw new BadRequestException('title is required');
    }

    return this.whatsappService.updateNewsGroupSettings(
      body.teacherId,
      body.title,
    );
  }

  @Post('groups/send-news-target')
  async sendLatestNewsToConfiguredGroup(
    @Body() body: { teacherId: string; title?: string; groupId?: string },
  ) {
    if (!body.teacherId) {
      throw new BadRequestException('teacherId is required');
    }

    return this.whatsappService.sendLatestNewsToConfiguredGroup(
      body.teacherId,
      {
        title: body.title,
        groupId: body.groupId,
      },
    );
  }

  @Post('dispatch-news')
  async dispatchNews(
    @Body()
    body: {
      teacherId: string;
      sendPrivate?: boolean;
      sendGroup?: boolean;
      groupTitle?: string;
      groupId?: string;
      groupLevel?: string;
    },
  ) {
    if (!body.teacherId) {
      throw new BadRequestException('teacherId is required');
    }

    return this.whatsappService.dispatchNews(body.teacherId, {
      sendPrivate: body.sendPrivate,
      sendGroup: body.sendGroup,
      groupTitle: body.groupTitle,
      groupId: body.groupId,
      groupLevel: body.groupLevel,
    });
  }

  @Post('send')
  @HttpCode(HttpStatus.OK)
  async sendMessage(
    @Body() body: { teacherId: string; number: string; text: string },
  ) {
    if (!body.teacherId) {
      throw new BadRequestException('teacherId is required');
    }
    await this.whatsappService.sendMessage(
      body.teacherId,
      body.number,
      body.text,
    );
    return { message: 'Requisição de envio processada!' };
  }

  @Post('send-latest-news-quiz')
  @HttpCode(HttpStatus.OK)
  async sendLatestNewsAndQuiz(
    @Body()
    body: {
      teacherId: string;
      number: string;
      mode?: 'GROUP' | 'PRIVATE';
    },
  ) {
    if (!body.teacherId) {
      throw new BadRequestException('teacherId is required');
    }
    if (!body.number) {
      throw new BadRequestException('Phone number is required');
    }

    const result = await this.whatsappService.sendLatestNewsAndQuiz(
      body.number,
      body.mode,
      body.teacherId,
    );
    return result;
  }

  @Post('send-weekly-summary')
  @HttpCode(HttpStatus.OK)
  async sendWeeklySummary(@Body() body: { teacherId: string }) {
    if (!body.teacherId) {
      throw new BadRequestException('teacherId is required');
    }

    const result = await this.whatsappService.sendWeeklyLessonSummaries(
      body.teacherId,
    );
    return result;
  }

  @Post('send-lesson-confirmations')
  @HttpCode(HttpStatus.OK)
  async sendLessonConfirmations(@Body() body: { teacherId: string }) {
    if (!body.teacherId) {
      throw new BadRequestException('teacherId is required');
    }

    const result = await this.whatsappService.sendTodayLessonConfirmations(
      body.teacherId,
    );
    return result;
  }

  @Post('send-quick-tips')
  @HttpCode(HttpStatus.OK)
  async sendQuickTips(@Body() body: { teacherId: string }) {
    if (!body.teacherId) {
      throw new BadRequestException('teacherId is required');
    }

    await this.whatsappService.sendQuickTips(body.teacherId);
    return { success: true };
  }
}
