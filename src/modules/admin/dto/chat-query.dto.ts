import { ConversationType, OrderStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CursorQueryDto } from '../../../common/dto/cursor-query.dto';

export class AdminConversationQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsEnum(ConversationType)
  type?: ConversationType;

  /** Ism, telefon, ID yoki buyurtma raqami. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  /** Suhbat bog‘langan buyurtmaning holati. */
  @IsOptional()
  @IsEnum(OrderStatus)
  orderStatus?: OrderStatus;

  /** deleted/edited/files — shunday xabari bor suhbatlar; disputed — buyurtmasida nizo yoki shikoyat bor suhbatlar. */
  @IsOptional()
  @IsIn(['deleted', 'edited', 'files', 'disputed'])
  flag?: 'deleted' | 'edited' | 'files' | 'disputed';

  @IsOptional()
  @IsIn(['recent', 'oldest', 'messages'])
  sort?: 'recent' | 'oldest' | 'messages';
}
