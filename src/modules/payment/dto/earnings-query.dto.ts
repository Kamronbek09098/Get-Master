import { IsDateString, IsOptional } from 'class-validator';
import { CursorQueryDto } from '../../../common/dto/cursor-query.dto';

export class EarningsQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
