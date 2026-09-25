import { Module } from '@nestjs/common';
import { OrderModule } from '../order/order.module';
import { WarrantyController } from './warranty.controller';
import { WarrantyService } from './warranty.service';

@Module({
  imports: [OrderModule],
  controllers: [WarrantyController],
  providers: [WarrantyService],
})
export class WarrantyModule {}
