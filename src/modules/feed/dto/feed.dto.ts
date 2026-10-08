import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { WorkPostKind } from '@prisma/client';

export const FEED_TABS = ['foryou', 'following', 'trend', 'saved'] as const;
export type FeedTab = (typeof FEED_TABS)[number];

export class FeedQueryDto {
  @IsOptional()
  @IsIn(FEED_TABS)
  tab?: FeedTab;

  @IsOptional()
  @IsUUID('4')
  category?: string;

  @IsOptional()
  @IsUUID('4')
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
  @IsUUID('4')
  categoryId?: string;

  @IsOptional()
  @IsUUID('4')
  serviceId?: string;

  @IsOptional()
  @IsUUID('4')
  videoAssetId?: string;

  @IsOptional()
  @IsUUID('4')
  coverAssetId?: string;

  @IsOptional()
  @IsUUID('4')
  beforeAssetId?: string;

  @IsOptional()
  @IsUUID('4')
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
