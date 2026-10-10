import { IsUUID } from '../../../common/validators/any-uuid';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { WorkPostKind } from '@prisma/client';

export const FEED_TABS = ['foryou', 'following', 'trend', 'saved'] as const;
export type FeedTab = (typeof FEED_TABS)[number];

export class FeedQueryDto {
  @IsOptional()
  @IsIn(FEED_TABS)
  tab?: FeedTab;

  @IsOptional()
  @IsUUID()
  category?: string;

  @IsOptional()
  @IsUUID()
  master?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  /** UUID (yangi→eski ro‘yxat) yoki son (trend va saqlanganlar uchun siljish). */
  @IsOptional()
  @Matches(/^([0-9a-f-]{36}|\d{1,6})$/i)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  limit?: number = 10;
}

export class CreateWorkPostDto {
  @IsEnum(WorkPostKind)
  kind!: WorkPostKind;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  caption?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @Transform(({ value }) => (Array.isArray(value) ? value.map((tag) => String(tag).trim().replace(/^#/, '').toLowerCase()).filter(Boolean) : value))
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  tags?: string[];

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @IsUUID()
  videoAssetId?: string;

  @IsOptional()
  @IsUUID()
  coverAssetId?: string;

  @IsOptional()
  @IsUUID()
  beforeAssetId?: string;

  @IsOptional()
  @IsUUID()
  afterAssetId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(600)
  durationSec?: number;
}

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  text!: string;
}
