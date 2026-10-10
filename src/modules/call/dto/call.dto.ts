import { IsUUID } from '../../../common/validators/any-uuid';
import { IsEnum, IsIn, IsNotEmpty, IsObject } from 'class-validator';
import { CallMode } from '@prisma/client';

export class StartCallDto {
  @IsUUID()
  conversationId!: string;

  @IsEnum(CallMode)
  mode!: CallMode;
}

export const SIGNAL_KINDS = ['offer', 'answer', 'candidate', 'media'] as const;
export type SignalKind = (typeof SIGNAL_KINDS)[number];

/** WebRTC signali: SDP (offer/answer), ICE nomzodi (candidate) yoki media holati (media: kamera/mikrofon yoqilgan-o‘chirilgan). */
export class CallSignalDto {
  @IsIn(SIGNAL_KINDS as unknown as string[])
  kind!: SignalKind;

  @IsNotEmpty()
  @IsObject()
  payload!: Record<string, unknown>;
}
