import { Module } from '@nestjs/common';
import { OrderModule } from '../order/order.module';
import { WorkController } from './work.controller';
import { WorkService } from './work.service';

@Module({
  imports: [OrderModule],
  controllers: [WorkController],
  providers: [WorkService],
})
export class WorkModule {}
