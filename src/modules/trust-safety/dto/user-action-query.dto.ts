import { IsUUID } from '../../../common/validators/any-uuid';
import { IsOptional } from 'class-validator';

export class UserActionQueryDto {
  @IsOptional()
  @IsUUID()
  userId?: string;
}
