import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AppealStatus } from '@prisma/client';

export class UpdateAppealDto {
  @IsEnum(AppealStatus)
  status!: AppealStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  decision?: string;
}
