import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export const SUPPORTED_LANGUAGES = ['UZ', 'RU', 'EN'] as const;
export const SUPPORTED_CURRENCIES = ['UZS', 'USD'] as const;

export const SUPPORTED_PAYMENT_METHODS = ['CASH', 'CLICK', 'PAYME', 'UZUM'] as const;

export class UpdateCustomerDto {
  /** Afzal ko‘rilgan to‘lov usuli (to‘lov oynasida oldindan tanlanadi). */
  @IsOptional()
  @IsIn(SUPPORTED_PAYMENT_METHODS)
  paymentMethod?: (typeof SUPPORTED_PAYMENT_METHODS)[number];

  @IsOptional()
  @IsIn(SUPPORTED_LANGUAGES)
  language?: (typeof SUPPORTED_LANGUAGES)[number];

  @IsOptional()
  @IsIn(SUPPORTED_CURRENCIES)
  currency?: (typeof SUPPORTED_CURRENCIES)[number];

  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;
}
