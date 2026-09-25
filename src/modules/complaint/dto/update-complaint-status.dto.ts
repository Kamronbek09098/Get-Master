import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CaseStatus } from '@prisma/client';

export class UpdateComplaintStatusDto {
  @IsEnum(CaseStatus)
  status!: CaseStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  decision?: string;
}
