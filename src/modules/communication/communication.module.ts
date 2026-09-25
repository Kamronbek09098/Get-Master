import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { OrderModule } from '../order/order.module';
import { CommunicationController } from './communication.controller';
import { CommunicationService } from './communication.service';

@Module({
  imports: [OrderModule, NotificationModule],
  controllers: [CommunicationController],
  providers: [CommunicationService],
  exports: [CommunicationService],
})
export class CommunicationModule {}
