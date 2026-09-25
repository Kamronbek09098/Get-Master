import { IsEnum, IsUUID } from 'class-validator';
import { PaymentProvider } from '@prisma/client';

export class CreatePaymentDto {
  @IsUUID('4')
  orderId!: string;

  @IsEnum(PaymentProvider)
  provider!: PaymentProvider;
}
