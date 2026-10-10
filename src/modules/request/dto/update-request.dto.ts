import { IsUUID } from '../../../common/validators/any-uuid';
import { Type } from 'class-transformer';
import { ServiceMode } from '@prisma/client';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @IsUUID()
  addressId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsDateString()
  preferredStartAt?: string;

  @IsOptional()
  @IsDateString()
  preferredEndAt?: string;

  @IsOptional()
  @IsEnum(ServiceMode)
  serviceMode?: ServiceMode;
}
