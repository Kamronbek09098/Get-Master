import { Module } from '@nestjs/common';
import { OrderModule } from '../order/order.module';
import { ComplaintController } from './complaint.controller';
import { ComplaintService } from './complaint.service';

@Module({
  imports: [OrderModule],
  controllers: [ComplaintController],
  providers: [ComplaintService],
})
export class ComplaintModule {}
