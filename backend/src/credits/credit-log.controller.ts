import { Controller, Get, Param, Query } from '@nestjs/common';
import { CreditsService } from './credits.service';

@Controller('credits')
export class CreditLogController {
  constructor(private readonly service: CreditsService) {}

  @Get('transactions/:userId')
  async getTransactions(
    @Param('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getTransactions(userId, Number(page) || 1, Number(limit) || 50);
  }
}
