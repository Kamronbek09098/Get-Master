import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreatePortfolioDto {
  @IsUUID()
  mediaAssetId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class UpdatePortfolioDto extends PartialType(OmitType(CreatePortfolioDto, ['mediaAssetId'] as const)) {}
