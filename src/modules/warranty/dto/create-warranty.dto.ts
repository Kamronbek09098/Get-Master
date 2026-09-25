import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { MAX_WARRANTY_DAYS } from '../../../common/constants/app.constants';

export class CreateWarrantyDto {
  @IsUUID('4')
  orderId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_WARRANTY_DAYS)
  days?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  conditions?: string;
}
