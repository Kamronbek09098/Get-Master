import { IsUUID } from '../../../common/validators/any-uuid';
import { Type } from 'class-transformer';
import { ServiceMode } from '@prisma/client';
import { IsIn } from 'class-validator';
import { REGION_KEYS } from '../../../common/constants/regions';
import { IsEnum, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { CursorQueryDto } from '../../../common/dto/cursor-query.dto';

export class MasterQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;

  /** Faqat shu rejimda ishlaydigan ustalar (mijoz manzilida / o‘z joyida). */
  @IsOptional()
  @IsEnum(ServiceMode)
  mode?: ServiceMode;

  /** Hudud kaliti (14 hudud): faqat shu hududdagi ustalar. */
  @IsOptional()
  @IsIn(REGION_KEYS)
  region?: string;
}
