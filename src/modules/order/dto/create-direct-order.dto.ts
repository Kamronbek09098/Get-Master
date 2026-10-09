import { Type } from 'class-transformer';
import { ServiceMode } from '@prisma/client';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsPositive, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/** Mijoz suhbat ichidan ustaga to‘g‘ridan-to‘g‘ri buyurtma yuboradi. */
export class CreateDirectOrderDto {
  @IsUUID('4')
  conversationId!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(255)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(4000)
  description!: string;

  /** Kelishilgan narx (so‘m). */
  @Type(() => Number)
  @IsPositive()
  price!: number;

  /** Ish bajarilishi kerak bo‘lgan vaqt: majburiy. */
  @IsNotEmpty()
  @IsDateString()
  scheduledStartAt!: string;

  @IsOptional()
  @IsUUID('4')
  addressId?: string;

  @IsOptional()
  @IsEnum(ServiceMode)
  serviceMode?: ServiceMode;
}
