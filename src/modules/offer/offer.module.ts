import { Module } from '@nestjs/common';
import { OfferController } from './offer.controller';
import { MasterModule } from '../master/master.module';
import { NotificationModule } from '../notification/notification.module';
import { OfferService } from './offer.service';

@Module({
  imports: [MasterModule, NotificationModule],
  controllers: [OfferController],
  providers: [OfferService],
  exports: [OfferService],
})
export class OfferModule {}
