import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { WarrantyClaimStatus } from '@prisma/client';

export class UpdateWarrantyClaimDto {
  @IsEnum(WarrantyClaimStatus)
  status!: WarrantyClaimStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resolution?: string;
}
