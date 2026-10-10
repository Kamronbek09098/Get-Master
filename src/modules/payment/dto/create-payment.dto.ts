import { IsUUID } from '../../../common/validators/any-uuid';
import { IsEnum } from 'class-validator';
import { PaymentProvider } from '@prisma/client';

export class CreatePaymentDto {
  @IsUUID()
  orderId!: string;

  @IsEnum(PaymentProvider)
  provider!: PaymentProvider;
}
