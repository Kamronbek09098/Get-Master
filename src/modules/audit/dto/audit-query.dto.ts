import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { DateRangeQueryDto } from '../../../common/dto/cursor-query.dto';

export class AuditQueryDto extends DateRangeQueryDto {
  @IsOptional()
  @IsUUID('4')
  actorId?: string;

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

  /** Amal nomi yoki sababdan qidirish. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
