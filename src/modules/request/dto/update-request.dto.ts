import { Type } from 'class-transformer';
import { ServiceMode } from '@prisma/client';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class UpdateRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @IsOptional()
  @IsUUID('4')
  serviceId?: string;

  @IsOptional()
  @IsUUID('4')
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
