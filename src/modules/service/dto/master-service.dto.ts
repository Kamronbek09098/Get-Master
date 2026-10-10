import { IsUUID } from '../../../common/validators/any-uuid';
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsPositive, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateMasterServiceDto {
  @IsUUID()
  serviceId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(1_000_000_000)
  basePrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(1440)
  estimatedMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateMasterServiceDto extends PartialType(OmitType(CreateMasterServiceDto, ['serviceId'] as const)) {}
