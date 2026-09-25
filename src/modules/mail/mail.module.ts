import { Module } from '@nestjs/common';
import { MailProviderModule } from '../../infrastructure/mail/mail.module';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';

@Module({
  imports: [MailProviderModule],
  controllers: [MailController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
