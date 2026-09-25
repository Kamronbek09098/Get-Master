import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { OrderStatus } from '@prisma/client';
import { CursorQueryDto } from '../../../common/dto/cursor-query.dto';

export class OrderHistoryQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
