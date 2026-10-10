import { IsUUID } from '../../../common/validators/any-uuid';
import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { CompensationType } from '@prisma/client';

export class CreateCompensationDto {
  @IsOptional()
  @IsUUID()
  caseId?: string;

  @IsUUID()
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
