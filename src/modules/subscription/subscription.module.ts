import { Global, Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { AdminSubscriptionController, SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';

@Global()
@Module({
  imports: [NotificationModule],
  controllers: [SubscriptionController, AdminSubscriptionController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
