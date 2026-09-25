import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsPositive, IsString, MaxLength } from 'class-validator';
import { RefundReason } from '@prisma/client';

export class CreateRefundDto {
  @Type(() => Number)
  @IsPositive()
  amount!: number;

  @IsEnum(RefundReason)
  reason!: RefundReason;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  note!: string;
}
