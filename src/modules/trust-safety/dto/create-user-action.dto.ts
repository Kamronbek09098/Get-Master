import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { RestrictionType, UserActionType } from '@prisma/client';

export class CreateUserActionDto {
  @IsUUID('4')
  userId!: string;

  @IsOptional()
  @IsUUID('4')
  caseId?: string;

  @IsOptional()
  @IsUUID('4')
  policyId?: string;

  @IsEnum(UserActionType)
  type!: UserActionType;

  @IsOptional()
  @IsEnum(RestrictionType)
  restrictionType?: RestrictionType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
