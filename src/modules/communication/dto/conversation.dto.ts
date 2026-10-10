import { IsUUID } from '../../../common/validators/any-uuid';


export class OpenConversationDto {
  @IsUUID()
  orderId!: string;
}

export class OpenDirectConversationDto {
  @IsUUID()
  masterId!: string;
}
