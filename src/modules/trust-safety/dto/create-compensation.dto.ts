import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { CompensationType } from '@prisma/client';

export class CreateCompensationDto {
  @IsOptional()
  @IsUUID('4')
  caseId?: string;

  @IsUUID('4')
  recipientId!: string;

  @IsEnum(CompensationType)
  type!: CompensationType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}
