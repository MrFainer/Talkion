import { Module, Global } from '@nestjs/common';
import { CreditsService } from './credits.service';
import { CreditsController } from './credits.controller';
import { CreditLogController } from './credit-log.controller';
import { MailService } from '../auth/mail.service';

@Global()
@Module({
  controllers: [CreditsController, CreditLogController],
  providers: [CreditsService, MailService],
  exports: [CreditsService],
})
export class CreditsModule {}
