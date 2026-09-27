import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { ClickController } from './click/click.controller';
import { ClickService } from './click/click.service';
import { PaymeController } from './payme/payme.controller';
import { PaymeService } from './payme/payme.service';

@Module({
  controllers: [PaymentController, ClickController, PaymeController],
  providers: [PaymentService, ClickService, PaymeService],
  exports: [PaymentService],
})
export class PaymentModule {}
