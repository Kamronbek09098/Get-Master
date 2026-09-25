import { OrderStatus } from '@prisma/client';
import { IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { DateRangeQueryDto } from '../../../common/dto/cursor-query.dto';

export class AdminOrderQueryDto extends DateRangeQueryDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  /** Buyurtma ID boshi, mijoz yoki usta ismi/telefoni, so‘rov sarlavhasi. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  /** true bo‘lsa, faqat nizoli yoki ochiq ish (case) bor buyurtmalar. */
  @IsOptional()
  @IsIn(['true'])
  flagged?: 'true';
}

export class AdminOrderActionDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}

export class AdminOrderResolveDto extends AdminOrderActionDto {
  /** COMPLETE — usta foydasiga yakunlash, CANCEL — bekor qilish. */
  @IsIn(['COMPLETE', 'CANCEL'])
  decision!: 'COMPLETE' | 'CANCEL';
}
