import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAppealDto {
  @IsOptional()
  @IsUUID('4')
  caseId?: string;

  @IsOptional()
  @IsUUID('4')
  actionId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}
