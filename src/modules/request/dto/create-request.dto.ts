import { Type } from 'class-transformer';
import { ServiceMode } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

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

  /** Ish bajarilishi kerak bo‘lgan vaqt: majburiy. */
  @IsNotEmpty()
  @IsDateString()
  preferredStartAt!: string;

  @IsOptional()
  @IsDateString()
  preferredEndAt?: string;

  /** AT_CUSTOMER — usta manzilga keladi (standart); AT_MASTER — mijoz ustaning joyiga boradi (sartaroshxona, avtoservis). */
  @IsOptional()
  @IsEnum(ServiceMode)
  serviceMode?: ServiceMode;
}
