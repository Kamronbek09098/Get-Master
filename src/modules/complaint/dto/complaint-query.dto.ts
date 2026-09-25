import { IsEnum, IsOptional } from 'class-validator';
import { CaseStatus } from '@prisma/client';
import { CursorQueryDto } from '../../../common/dto/cursor-query.dto';

export class ComplaintQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;
}
