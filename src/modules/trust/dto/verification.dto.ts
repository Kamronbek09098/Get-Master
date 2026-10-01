import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { MasterVerificationStatus, VerificationDocumentType } from '@prisma/client';
import { CursorQueryDto } from '../../../common/dto/cursor-query.dto';

export class SubmitVerificationDto {
  @IsEnum(VerificationDocumentType)
  documentType!: VerificationDocumentType;

  @IsUUID()
  mediaAssetId!: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date;
}

export const REVIEW_DECISIONS = ['START_REVIEW', 'APPROVE', 'REJECT', 'REQUEST_CORRECTION'] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export class ReviewVerificationDto {
  @IsIn(REVIEW_DECISIONS)
  decision!: ReviewDecision;

  @ValidateIf((o: ReviewVerificationDto) => o.decision === 'REJECT' || o.decision === 'REQUEST_CORRECTION')
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason?: string;
}

export class VerificationQueryDto extends CursorQueryDto {
  @IsOptional()
  @IsEnum(MasterVerificationStatus)
  status?: MasterVerificationStatus;

  @IsOptional()
  @IsUUID()
  masterId?: string;

  /** `true` bo‘lsa — ko‘rib chiqib bo‘lingan hujjatlar tarixi (ular hech qachon yo‘qolmaydi). */
  @IsOptional()
  @IsIn(['true', 'false'])
  history?: string;
}
