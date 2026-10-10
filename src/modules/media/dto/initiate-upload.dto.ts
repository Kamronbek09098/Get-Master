import { IsUUID } from '../../../common/validators/any-uuid';
import { IsEnum, IsIn, IsNotEmpty } from 'class-validator';
import { MediaAssetKind } from '@prisma/client';

export class InitiateUploadDto {
  @IsEnum(MediaAssetKind)
  kind!: MediaAssetKind;

  @IsIn(['ProblemRequest', 'Order', 'Conversation', 'MasterProfile', 'Subscription', 'User'])
  linkType!: 'ProblemRequest' | 'Order' | 'Conversation' | 'MasterProfile' | 'Subscription' | 'User';

  @IsUUID()
  @IsNotEmpty()
  linkId!: string;
}
