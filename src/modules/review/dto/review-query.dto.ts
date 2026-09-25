import { IsUUID } from 'class-validator';
import { CursorQueryDto } from '../../../common/dto/cursor-query.dto';

export class ReviewQueryDto extends CursorQueryDto {
  @IsUUID()
  masterId!: string;
}
