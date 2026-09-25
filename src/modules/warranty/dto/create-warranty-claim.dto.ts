import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateWarrantyClaimDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  reason!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  evidenceKey?: string;
}
