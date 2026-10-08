import { Type } from 'class-transformer';
import { ServiceMode } from '@prisma/client';
import { IsIn } from 'class-validator';
import { REGION_KEYS } from '../../../common/constants/regions';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class PublicMasterQueryDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  limit?: number;

  @IsOptional()
  @IsEnum(ServiceMode)
  mode?: ServiceMode;

  /** Hudud kaliti (14 hudud): faqat shu hududdagi ustalar. */
  @IsOptional()
  @IsIn(REGION_KEYS)
  region?: string;
}
