import { IsUUID } from '../../../common/validators/any-uuid';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAppealDto {
  @IsOptional()
  @IsUUID()
  caseId?: string;

  @IsOptional()
  @IsUUID()
  actionId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}
