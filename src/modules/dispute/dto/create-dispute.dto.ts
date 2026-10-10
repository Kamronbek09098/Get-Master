import { IsUUID } from '../../../common/validators/any-uuid';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { EvidenceType } from '@prisma/client';

export class DisputeEvidenceDto {
  @IsEnum(EvidenceType)
  type!: EvidenceType;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  storageKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  text?: string;
}

export class CreateDisputeDto {
  @IsUUID()
  orderId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => DisputeEvidenceDto)
  evidence?: DisputeEvidenceDto[];
}
