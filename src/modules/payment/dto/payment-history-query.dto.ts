import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { PaymentProvider, PaymentStatus } from '@prisma/client';
import { CursorQueryDto } from '../../../common/dto/cursor-query.dto';

export class PaymentHistoryQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsEnum(PaymentProvider)
  provider?: PaymentProvider;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
