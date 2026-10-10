import { PaymentProvider } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ConfirmCompletionDto {
  /** Eskirgan: endi e’tiborga olinmaydi — to‘lov ishni tasdiqlashdan OLDIN alohida (to‘lov kartasida) amalga oshiriladi. Eski mijozlar bilan moslik uchun qabul qilinadi. */
  @IsOptional()
  @IsEnum(PaymentProvider)
  paymentMethod?: PaymentProvider;
}
