import { BadRequestException, Injectable, Logger, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import type { Request } from 'express';
import { ERRORS } from '../../common/constants/error-messages';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TelegramAlertService } from '../../infrastructure/telegram/telegram-alert.service';

/** Telegram hujjat yuborish chegarasi (bot API) — 50 MB. */
export const MAX_RECORDING_BYTES = 49 * 1024 * 1024;
const MIME_TYPES = ['video/webm', 'audio/webm', 'video/mp4', 'audio/mp4', 'audio/ogg'];

/** Toshkent vaqti: 2026-10-07_20-39-12. */
const stamp = (date: Date) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
      .formatToParts(date)
      .map((item) => [item.type, item.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}_${parts.hour}-${parts.minute}-${parts.second}`;
};
const esc = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fullName = (user: { firstName: string | null; lastName: string | null; phone: string | null }) =>
  [user.firstName, user.lastName].filter(Boolean).join(' ') || user.phone || '—';

/**
 * Qo‘ng‘iroq yozuvi: har bir ishtirokchi o‘z mikrofon/kamerasini yozadi va qo‘ng‘iroq tugagach yuboradi.
 * Yozuv faqat xotirada ushlanib, Telegram guruhiga uzatiladi va darhol unutiladi — bazada ham, fayl omborida ham SAQLANMAYDI.
 */
@Injectable()
export class CallRecordingService {
  private readonly logger = new Logger(CallRecordingService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly telegram: TelegramAlertService,
  ) {}

  async forward(userId: string, callId: string, req: Request, partRaw?: string) {
    const part = Math.min(Math.max(Number.parseInt(partRaw ?? '1', 10) || 1, 1), 999);
    const call = await this.db.call.findUnique({
      where: { id: callId },
      include: {
        caller: { select: { id: true, firstName: true, lastName: true, phone: true } },
        callee: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    });
    if (!call || (call.callerId !== userId && call.calleeId !== userId)) throw new NotFoundException(ERRORS.CALL_NOT_FOUND);
    if (!call.answeredAt) throw new BadRequestException(ERRORS.CALL_INVALID_STATE);
    const mime = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
    if (!MIME_TYPES.includes(mime)) throw new BadRequestException(ERRORS.CALL_RECORDING_TYPE);
    if (Number(req.headers['content-length'] ?? 0) > MAX_RECORDING_BYTES) throw new PayloadTooLargeException(ERRORS.CALL_RECORDING_TOO_LARGE);
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req as AsyncIterable<Buffer>) {
      size += chunk.length;
      if (size > MAX_RECORDING_BYTES) throw new PayloadTooLargeException(ERRORS.CALL_RECORDING_TOO_LARGE);
      chunks.push(chunk);
    }
    if (size < 512) throw new BadRequestException(ERRORS.CALL_RECORDING_TYPE);
    const data = Buffer.concat(chunks);
    const owner = call.callerId === userId ? call.caller : call.callee;
    const other = call.callerId === userId ? call.callee : call.caller;
    const seconds = call.endedAt ? Math.max(0, Math.round((call.endedAt.getTime() - call.answeredAt.getTime()) / 1000)) : 0;
    const kind = call.mode === 'VIDEO' ? 'VIDEO' : 'AUDIO';
    const caption = [
      `${kind === 'VIDEO' ? '🎥 Video' : '🎙 Audio'} qo‘ng‘iroq yozuvi`,
      `<b>Yozuv egasi:</b> ${esc(fullName(owner))}${owner.phone ? ` (${esc(owner.phone)})` : ''}`,
      `<b>Suhbatdosh:</b> ${esc(fullName(other))}${other.phone ? ` (${esc(other.phone)})` : ''}`,
      `<b>Boshlangan:</b> ${call.answeredAt.toISOString().replace('T', ' ').slice(0, 19)} UTC · <b>Davomiyligi:</b> ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`,
      `<b>Qo‘ng‘iroq:</b> ${call.id}`,
    ].join('\n');
    // Fayl nomi: {qo‘ng‘iroq sanasi}-{bo‘lak raqami} (bo‘linmagan bo‘lsa 1), masalan 2026-10-07_20-39-12-1.webm.
    const fileBase = `${stamp(call.answeredAt)}-${part}`;
    const delivered = await this.telegram.sendCallRecording({ kind, data, mimeType: mime, caption: `${caption}\n<b>Bo‘lak:</b> ${part}`, fileBase });
    if (!delivered) this.logger.warn(`Qo‘ng‘iroq ${callId} yozuvi Telegram’ga yetkazilmadi; saqlanmadi.`);
    return { delivered };
  }
}
