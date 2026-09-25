import { ConversationType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CursorQueryDto } from '../../../common/dto/cursor-query.dto';

export class AdminConversationQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsEnum(ConversationType)
  type?: ConversationType;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
