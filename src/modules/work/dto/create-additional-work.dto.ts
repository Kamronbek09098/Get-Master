import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateAdditionalWorkDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  reason!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  evidenceKey?: string;
}
