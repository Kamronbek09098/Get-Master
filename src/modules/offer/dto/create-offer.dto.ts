import { IsUUID } from '../../../common/validators/any-uuid';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, MaxLength, Min } from 'class-validator';

export class CreateOfferDto {
  @IsUUID()
  requestId!: string;

  @Type(() => Number)
  @IsPositive()
  price!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  estimatedMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  @IsOptional()
  @IsDateString()
  availableAt?: string;

  @IsOptional()
  @IsDateString()
  @IsNotEmpty()
  expiresAt?: string;
}
