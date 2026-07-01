import { Controller, Get, Param, Logger } from '@nestjs/common';
import { AffiliateService } from './affiliate.service';

@Controller('affiliate')
export class AffiliateController {
  private readonly logger = new Logger(AffiliateController.name);

  constructor(private readonly service: AffiliateService) {}

  @Get('link/:userId')
  async getLink(@Param('userId') userId: string) {
    return this.service.getAffiliateLink(userId);
  }

  @Get('stats/:userId')
  async getStats(@Param('userId') userId: string) {
    return this.service.getStats(userId);
  }
}
