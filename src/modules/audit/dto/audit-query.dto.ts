import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { DateRangeQueryDto } from '../../../common/dto/cursor-query.dto';

export type ActorRole = 'ADMIN' | 'MASTER' | 'CUSTOMER' | 'SYSTEM';

export class AuditQueryDto extends DateRangeQueryDto {
  @IsOptional()
  @IsUUID('4')
  actorId?: string;

  /** Bajaruvchining raqamli ID si (akkaunt raqami). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  actorNumber?: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  action?: string;

  /** Amal nomi shu prefiks bilan boshlanadi (masalan, AUTH_, VERIFICATION_). */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetType?: string;

  @IsOptional()
  @IsUUID('4')
  targetId?: string;

  /** Amalni kim bajargani: admin, usta, mijoz yoki tizim (bajaruvchisiz). */
  @IsOptional()
  @IsIn(['ADMIN', 'MASTER', 'CUSTOMER', 'SYSTEM'])
  actorRole?: ActorRole;

  /** Amal nomi yoki sababdan qidirish. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
