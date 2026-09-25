import { Module } from '@nestjs/common';
import { MasterModule } from '../master/master.module';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

@Module({
  imports: [MasterModule],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
