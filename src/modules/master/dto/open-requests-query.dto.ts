import { IsIn, IsOptional } from 'class-validator';
import { CursorQueryDto } from '../../../common/dto/cursor-query.dto';

export class OpenRequestsQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsIn(['mine', 'all', 'notified'])
  scope?: 'mine' | 'all' | 'notified';
}
