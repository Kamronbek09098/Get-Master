import { IsUUID } from '../../../common/validators/any-uuid';

import { CursorQueryDto } from '../../../common/dto/cursor-query.dto';

export class ReviewQueryDto extends CursorQueryDto {
  @IsUUID()
  masterId!: string;
}
