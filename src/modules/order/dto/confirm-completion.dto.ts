import { PaymentProvider } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ConfirmCompletionDto {
  /** Mijoz to‘lov usulini tanlaydi (naqd yoki onlayn); to‘lov yozuvi shu bilan yaratiladi. */
  @IsOptional()
  @IsEnum(PaymentProvider)
  paymentMethod?: PaymentProvider;
}
