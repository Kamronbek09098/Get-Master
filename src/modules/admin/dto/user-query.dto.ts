import { UserStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CursorQueryDto } from '../../../common/dto/cursor-query.dto';

export class UserQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsIn(['CUSTOMER', 'MASTER', 'ADMIN'])
  role?: 'CUSTOMER' | 'MASTER' | 'ADMIN';

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
