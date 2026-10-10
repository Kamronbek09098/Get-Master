import { IsUUID } from '../../../common/validators/any-uuid';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { RestrictionType, UserActionType } from '@prisma/client';

export class CreateUserActionDto {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsUUID()
  caseId?: string;

  @IsOptional()
  @IsUUID()
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
