import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class PaymentsReportQueryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(['CASH', 'CLICK', 'PAYME', 'UZUM', 'OTHER'])
  provider?: 'CASH' | 'CLICK' | 'PAYME' | 'UZUM' | 'OTHER';

  @IsOptional()
  @IsIn(['succeeded', 'pending', 'refunded', 'other'])
  status?: 'succeeded' | 'pending' | 'refunded' | 'other';

  @IsOptional()
  @IsIn(['createdAt', 'amount', 'status'])
  sort?: 'createdAt' | 'amount' | 'status';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  dir?: 'asc' | 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
