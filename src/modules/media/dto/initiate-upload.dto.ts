import { IsEnum, IsIn, IsNotEmpty, IsUUID } from 'class-validator';
import { MediaAssetKind } from '@prisma/client';

export class InitiateUploadDto {
  @IsEnum(MediaAssetKind)
  kind!: MediaAssetKind;

  @IsIn(['ProblemRequest', 'Order', 'Conversation', 'MasterProfile', 'Subscription'])
  linkType!: 'ProblemRequest' | 'Order' | 'Conversation' | 'MasterProfile' | 'Subscription';

  @IsUUID('4')
  @IsNotEmpty()
  linkId!: string;
}
