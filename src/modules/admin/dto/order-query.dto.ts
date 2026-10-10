import { Type } from 'class-transformer';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { IsArray, IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { IsUUID } from '../../../common/validators/any-uuid';
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

  /** true bo‘lsa, hali yakunlanmagan/bekor qilinmagan barcha "jarayondagi" holatlar (band qilingandan tortib tasdiq kutilmoqdagacha). */
  @IsOptional()
  @IsIn(['true'])
  ongoing?: 'true';

  /** Sahifalab (raqamli) ko‘rsatish: berilsa, javobda jami son va sahifalar soni bo‘ladi. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page?: number;

  @IsOptional()
  @IsIn(['createdAt', 'amount'])
  sort?: 'createdAt' | 'amount';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  dir?: 'asc' | 'desc';

  /** To‘lov holati yoki NONE — hech qanday to‘lov urinishi yo‘q. */
  @IsOptional()
  @IsIn(['NONE', ...Object.values(PaymentStatus)])
  payment?: 'NONE' | PaymentStatus;

  @IsOptional()
  @IsUUID()
  category?: string;

  /** Hudud (buyurtma manzilidagi shahar/tuman nomi). */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;
}

export class AdminOrderBulkCancelDto {
  @IsArray()
  @IsUUID('all', { each: true })
  ids!: string[];

  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
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
