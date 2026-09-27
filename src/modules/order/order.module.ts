import { Module } from '@nestjs/common';
import { MasterModule } from '../master/master.module';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { DirectOrderService } from './direct-order.service';
import { OrderReminderService } from './order-reminder.service';

@Module({
  imports: [MasterModule],
  controllers: [OrderController],
  providers: [OrderService, DirectOrderService, OrderReminderService],
  exports: [OrderService],
})
export class OrderModule {}
