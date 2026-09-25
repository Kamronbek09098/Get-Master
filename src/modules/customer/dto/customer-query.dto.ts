import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { UserStatus } from '@prisma/client';
import { CursorQueryDto } from '../../../common/dto/cursor-query.dto';

export class CustomerQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
