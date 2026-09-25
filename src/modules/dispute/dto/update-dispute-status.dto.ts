import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { CaseStatus } from '@prisma/client';

export class UpdateDisputeStatusDto {
  @IsEnum(CaseStatus)
  status!: CaseStatus;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  decision?: string;
}
