import { IsIn, IsUUID } from 'class-validator';
import { WorkStage } from '@prisma/client';

export class CreateWorkProofDto {
  @IsIn(['BEFORE', 'DURING', 'AFTER'])
  stage!: WorkStage;

  @IsUUID('4')
  mediaAssetId!: string;
}
