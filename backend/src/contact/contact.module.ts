import { Module } from '@nestjs/common';
import { ContactController } from './contact.controller';
import { MailService } from '../auth/mail.service';

@Module({
  controllers: [ContactController],
  providers: [MailService],
})
export class ContactModule {}
