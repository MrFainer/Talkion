import { Controller, Get, Patch, Param, Body, BadRequestException } from '@nestjs/common';
import { CreditsService } from './credits.service';

@Controller('credits')
export class CreditsController {
  constructor(private readonly service: CreditsService) {}

  @Get('config')
  async getAllCosts() {
    return this.service.getAllCosts();
  }

  @Patch('config/:key')
  async updateCost(@Param('key') key: string, @Body() body: { current_cost: number }) {
    if (body.current_cost == null || body.current_cost < 0) {
      throw new BadRequestException('current_cost é obrigatório e deve ser >= 0');
    }
    return this.service.updateCost(key, body.current_cost);
  }

  @Get('balance/:userId')
  async getBalance(@Param('userId') userId: string) {
    const balance = await this.service.getBalance(userId);
    return { balance };
  }

  @Get('transactions/:userId')
  async getTransactions(@Param('userId') userId: string) {
    return this.service.getTransactions(userId);
  }

  @Get('check/:userId/:actionKey')
  async checkBalance(@Param('userId') userId: string, @Param('actionKey') actionKey: string) {
    return this.service.checkBalance(userId, actionKey);
  }
}
