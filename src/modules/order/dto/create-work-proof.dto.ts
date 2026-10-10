import { IsUUID } from '../../../common/validators/any-uuid';
import { IsIn } from 'class-validator';
import { WorkStage } from '@prisma/client';

export class CreateWorkProofDto {
  @IsIn(['BEFORE', 'DURING', 'AFTER'])
  stage!: WorkStage;

  @IsUUID()
  mediaAssetId!: string;
}
