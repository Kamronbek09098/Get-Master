import { IsUUID } from '../../../common/validators/any-uuid';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CursorQueryDto } from '../../../common/dto/cursor-query.dto';

export class ServiceQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
