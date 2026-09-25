import { IsEnum, IsOptional } from 'class-validator';
import { OfferStatus } from '@prisma/client';
import { CursorQueryDto } from '../../../common/dto/cursor-query.dto';

export class OfferQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsEnum(OfferStatus)
  status?: OfferStatus;
}
