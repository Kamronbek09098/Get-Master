import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PAYMENT_METHODS, PLAN_MONTHS } from '../plans.config';

export class RequestSubscriptionDto {
  @IsIn(['CUSTOMER_PLUS', 'MASTER_PRO'])
  planCode!: 'CUSTOMER_PLUS' | 'MASTER_PRO';

  @Type(() => Number)
  @IsInt()
  @IsIn(PLAN_MONTHS)
  months!: 1 | 3 | 12;

  @IsIn(PAYMENT_METHODS as unknown as string[])
  method!: (typeof PAYMENT_METHODS)[number];
}

export class GrantSubscriptionDto {
  /** Foydalanuvchi ID si (akkaunt raqami) yoki UUID. */
  @IsString()
  @MaxLength(40)
  user!: string;

  @IsIn(['CUSTOMER_PLUS', 'MASTER_PRO'])
  planCode!: 'CUSTOMER_PLUS' | 'MASTER_PRO';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(36)
  months!: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class AttachReceiptDto {
  @IsUUID('4')
  mediaAssetId!: string;
}

export class RejectSubscriptionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason!: string;
}

export class AdminSubscriptionQueryDto {
  @IsOptional()
  @IsIn(['PENDING', 'ACTIVE', 'EXPIRED', 'CANCELED', 'REJECTED'])
  status?: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELED' | 'REJECTED';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  q?: string;

  @IsOptional()
  @IsIn(['CLICK', 'PAYME', 'UZUM', 'CARD'])
  method?: 'CLICK' | 'PAYME' | 'UZUM' | 'CARD';
}

export class SubscriptionIdParam {
  @IsUUID('4')
  id!: string;
}

export class SubscriptionUserQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @IsIn(['CUSTOMER', 'MASTER'])
  audience?: 'CUSTOMER' | 'MASTER';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}
