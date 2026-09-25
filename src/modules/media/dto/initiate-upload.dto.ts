import { IsEnum, IsIn, IsNotEmpty, IsUUID } from 'class-validator';
import { MediaAssetKind } from '@prisma/client';

export class InitiateUploadDto {
  @IsEnum(MediaAssetKind)
  kind!: MediaAssetKind;

  @IsIn(['ProblemRequest', 'Order', 'Conversation', 'MasterProfile'])
  linkType!: 'ProblemRequest' | 'Order' | 'Conversation' | 'MasterProfile';

  @IsUUID('4')
  @IsNotEmpty()
  linkId!: string;
}
