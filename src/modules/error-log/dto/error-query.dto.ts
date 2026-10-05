import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class ErrorListQueryDto {
  @IsOptional() @IsIn(['SERVER', 'CLIENT'])
  source?: 'SERVER' | 'CLIENT';

  @IsOptional() @IsIn(['ERROR', 'WARNING'])
  severity?: 'ERROR' | 'WARNING';

  @IsOptional() @IsIn(['HTTP', 'UNHANDLED', 'UI_CRASH', 'UI_ERROR', 'API_ERROR', 'NETWORK'])
  kind?: string;

  @IsOptional() @IsIn(['CUSTOMER', 'MASTER', 'ADMIN'])
  panel?: string;

  @IsOptional() @IsIn(['web', 'android', 'ios'])
  platform?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(599)
  status?: number;

  @IsOptional() @IsIn(['open', 'resolved'])
  state?: 'open' | 'resolved';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  accountNumber?: number;

  @IsOptional() @IsString() @MaxLength(64)
  fingerprint?: string;

  @IsOptional() @IsString() @MaxLength(200)
  q?: string;

  @IsOptional() @IsDateString()
  from?: string;

  @IsOptional() @IsDateString()
  to?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number;
}

export class ErrorGroupsQueryDto {
  @IsOptional() @Type(() => Number) @IsIn([1, 7, 30])
  days?: number;
}

export class ResolveErrorsDto {
  @IsOptional() @IsUUID('4', { each: true })
  ids?: string[];

  @IsOptional() @IsString() @MaxLength(64)
  fingerprint?: string;

  @IsOptional()
  value?: boolean;
}
