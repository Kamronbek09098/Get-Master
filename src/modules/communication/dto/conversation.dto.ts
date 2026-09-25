import { IsUUID } from 'class-validator';

export class OpenConversationDto {
  @IsUUID()
  orderId!: string;
}

export class OpenDirectConversationDto {
  @IsUUID()
  masterId!: string;
}
