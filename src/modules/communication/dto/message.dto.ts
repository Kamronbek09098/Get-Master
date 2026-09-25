import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_ATTACHMENTS_PER_MESSAGE = 5;

export class SendMessageDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_MESSAGE_LENGTH)
  text?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ATTACHMENTS_PER_MESSAGE)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  mediaAssetIds?: string[];

  @IsOptional()
  @IsUUID('all')
  replyToId?: string;
}

export class EditMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_MESSAGE_LENGTH)
  text!: string;
}

export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏'] as const;

export class ReactMessageDto {
  @IsOptional()
  @IsIn([...REACTION_EMOJIS])
  emoji?: string | null;
}
