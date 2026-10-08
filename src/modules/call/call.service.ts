import { PushService } from '../push/push.service';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { Call, CallMode, CallStatus } from '@prisma/client';
import { createHmac } from 'node:crypto';
import { ERRORS } from '../../common/constants/error-messages';
import type { Panel } from '../../common/utils/panel';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { NotificationService } from '../notification/notification.service';
import { CallEventsService } from './call-events.service';
import type { CallSignalDto, SignalKind } from './dto/call.dto';

const LIVE: CallStatus[] = [CallStatus.RINGING, CallStatus.ACTIVE];
const MAX_SIGNAL_BYTES = 24 * 1024;
const PING_TTL_SECONDS = 40;

type Role = 'CUSTOMER' | 'MASTER' | 'ADMIN';

export interface CallView {
  id: string;
  conversationId: string;
  mode: CallMode;
  status: CallStatus;
  callerId: string;
  calleeId: string;
  createdAt: Date;
  answeredAt: Date | null;
}

const toView = (call: Call): CallView => ({
  id: call.id,
  conversationId: call.conversationId,
  mode: call.mode,
  status: call.status,
  callerId: call.callerId,
  calleeId: call.calleeId,
  createdAt: call.createdAt,
  answeredAt: call.answeredAt,
});

const nameOf = (user: { firstName: string | null; lastName: string | null }): string =>
  [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Foydalanuvchi';

@Injectable()
export class CallService implements OnModuleDestroy {
  private readonly logger = new Logger(CallService.name);
  private readonly ringTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly events: CallEventsService,
    private readonly notifications: NotificationService,
    private readonly push: PushService,
  ) {}

  onModuleDestroy(): void {
    for (const timer of this.ringTimers.values()) clearTimeout(timer);
    this.ringTimers.clear();
  }

  /** ICE serverlar: STUN + (sozlangan bo‘lsa) TURN. TURN_SECRET bilan — vaqtinchalik HMAC login/parol (coturn use-auth-secret). */
  iceServers(userId: string): { iceServers: Array<{ urls: string[]; username?: string; credential?: string }>; hasTurn: boolean } {
    const stunUrls = this.config.get<string[]>('webrtc.stunUrls', []);
    const turnUrls = this.config.get<string[]>('webrtc.turnUrls', []);
    const iceServers: Array<{ urls: string[]; username?: string; credential?: string }> = [];
    if (stunUrls.length > 0) iceServers.push({ urls: stunUrls });
    if (turnUrls.length > 0) {
      const secret = this.config.get<string>('webrtc.turnSecret', '');
      if (secret) {
        const expires = Math.floor(Date.now() / 1000) + this.config.get<number>('webrtc.turnTtlSeconds', 3600);
        const username = `${expires}:${userId}`;
        iceServers.push({ urls: turnUrls, username, credential: createHmac('sha1', secret).update(username).digest('base64') });
      } else {
        iceServers.push({ urls: turnUrls, username: this.config.get<string>('webrtc.turnUsername', ''), credential: this.config.get<string>('webrtc.turnCredential', '') });
      }
    }
    return { iceServers, hasTurn: turnUrls.length > 0 };
  }

  /** Foydalanuvchining shu paneldagi hozirgi (jiringlayotgan yoki davom etayotgan) qo‘ng‘irog‘i — sahifa qayta yuklanganda tiklash uchun. */
  async current(userId: string, panel: Panel | null) {
    const call = await this.db.call.findFirst({
      where: {
        status: { in: LIVE },
        OR: [
          { callerId: userId, ...(panel ? { callerPanel: panel } : {}) },
          { calleeId: userId, ...(panel ? { calleePanel: panel } : {}) },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: { caller: { select: { id: true, firstName: true, lastName: true } }, callee: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!call) return null;
    const peer = call.callerId === userId ? call.callee : call.caller;
    return { call: toView(call), peer: { id: peer.id, name: nameOf(peer) } };
  }

  async start(userId: string, panel: Panel | null, conversationId: string, mode: CallMode) {
    const conversation = await this.db.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        type: true,
        order: { select: { status: true } },
        participants: { select: { userId: true, roles: true, user: { select: { id: true, firstName: true, lastName: true, status: true } } } },
      },
    });
    if (!conversation) throw new NotFoundException(ERRORS.CONVERSATION_NOT_FOUND);
    const own = conversation.participants.find((item) => item.userId === userId);
    if (!own || (panel && own.roles.length > 0 && panel !== 'ADMIN' && !own.roles.includes(panel))) throw new ForbiddenException(ERRORS.NOT_CONVERSATION_PARTICIPANT);
    if (conversation.type === 'SUPPORT' || conversation.participants.length !== 2 || own.roles.includes('ADMIN')) throw new ForbiddenException(ERRORS.CALL_NOT_ALLOWED);
    const peer = conversation.participants.find((item) => item.userId !== userId)!;
    if (peer.roles.includes('ADMIN') || peer.user.status !== 'ACTIVE') throw new ForbiddenException(ERRORS.CALL_NOT_ALLOWED);
    if (conversation.order && (conversation.order.status === 'CANCELLED' || conversation.order.status === 'EXPIRED')) throw new ConflictException(ERRORS.CALL_CONVERSATION_CLOSED);

    const calleePanel = this.peerPanel(peer.roles, panel);
    const busy = await this.db.call.findFirst({
      where: { status: { in: LIVE }, OR: [{ callerId: userId }, { calleeId: userId }, { callerId: peer.userId }, { calleeId: peer.userId }] },
      select: { callerId: true, calleeId: true },
    });
    if (busy) throw new ConflictException(busy.callerId === userId || busy.calleeId === userId ? ERRORS.CALL_SELF_BUSY : ERRORS.CALL_PEER_BUSY);

    const caller = await this.db.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, firstName: true, lastName: true } });
    // Ilova yopiq bo‘lsa ham (push tokeni bor) qo‘ng‘iroq jiringlaydi: telefonga push boradi, ochilganda qo‘ng‘iroq ko‘rinadi.
    const connected = await this.events.isOnline(peer.userId, calleePanel);
    const online = connected || (await this.push.hasTokens(peer.userId));
    const call = await this.db.call.create({
      data: {
        conversationId,
        callerId: userId,
        calleeId: peer.userId,
        callerPanel: panel,
        calleePanel,
        mode,
        status: online ? CallStatus.RINGING : CallStatus.MISSED,
        endReason: online ? null : 'offline',
        endedAt: online ? null : new Date(),
      },
    });

    if (!online) {
      await this.afterEnd(call, caller, 'offline');
      return { call: toView(call), peer: { id: peer.userId, name: nameOf(peer.user) }, calleeOnline: false };
    }

    await this.events.emit(peer.userId, calleePanel, 'call.incoming', { call: toView(call), from: { id: caller.id, name: nameOf(caller) } });
    if (!connected) {
      void this.push.sendToUser(peer.userId, {
        title: nameOf(caller),
        body: mode === 'VIDEO' ? 'Video qo‘ng‘iroq qilmoqda' : 'Audio qo‘ng‘iroq qilmoqda',
        kind: 'call',
        data: { type: 'call.incoming', callId: call.id, conversationId },
      });
    }
    this.armRingTimer(call.id);
    return { call: toView(call), peer: { id: peer.userId, name: nameOf(peer.user) }, calleeOnline: true };
  }

  async accept(userId: string, callId: string) {
    const call = await this.requireParticipant(userId, callId);
    if (call.calleeId !== userId) throw new ForbiddenException(ERRORS.CALL_NOT_ALLOWED);
    const result = await this.db.call.updateMany({ where: { id: callId, status: CallStatus.RINGING }, data: { status: CallStatus.ACTIVE, answeredAt: new Date() } });
    if (result.count === 0) throw new ConflictException(ERRORS.CALL_INVALID_STATE);
    this.clearRingTimer(callId);
    await this.touch(callId, userId);
    await this.events.emit(call.callerId, (call.callerPanel as Panel | null) ?? null, 'call.accepted', { callId });
    return { call: toView(await this.db.call.findUniqueOrThrow({ where: { id: callId } })) };
  }

  async decline(userId: string, callId: string) {
    const call = await this.requireParticipant(userId, callId);
    if (call.calleeId !== userId) throw new ForbiddenException(ERRORS.CALL_NOT_ALLOWED);
    return this.finish(call, userId, [CallStatus.RINGING], CallStatus.DECLINED, 'declined');
  }

  async cancel(userId: string, callId: string) {
    const call = await this.requireParticipant(userId, callId);
    if (call.callerId !== userId) throw new ForbiddenException(ERRORS.CALL_NOT_ALLOWED);
    return this.finish(call, userId, [CallStatus.RINGING], CallStatus.CANCELED, 'canceled');
  }

  async end(userId: string, callId: string, reason = 'hangup') {
    const call = await this.requireParticipant(userId, callId);
    if (call.status === CallStatus.RINGING) {
      // Jiringlash paytida: chaqiruvchi bekor qiladi, chaqirilgan rad etadi.
      return call.callerId === userId ? this.finish(call, userId, [CallStatus.RINGING], CallStatus.CANCELED, 'canceled') : this.finish(call, userId, [CallStatus.RINGING], CallStatus.DECLINED, 'declined');
    }
    return this.finish(call, userId, [CallStatus.ACTIVE], CallStatus.ENDED, reason === 'failed' ? 'failed' : 'hangup');
  }

  /** Qo‘ng‘iroq davomida «tirikman» belgisi (brauzer o‘chib qolsa, qo‘ng‘iroq osilib qolmasligi uchun). */
  async ping(userId: string, callId: string): Promise<{ alive: boolean }> {
    const call = await this.requireParticipant(userId, callId);
    if (!LIVE.includes(call.status)) return { alive: false };
    await this.touch(callId, userId);
    return { alive: true };
  }

  async signal(userId: string, callId: string, dto: CallSignalDto) {
    if (JSON.stringify(dto.payload).length > MAX_SIGNAL_BYTES) throw new BadRequestException(ERRORS.CALL_SIGNAL_TOO_LARGE);
    const call = await this.requireParticipant(userId, callId);
    if (!LIVE.includes(call.status)) throw new ConflictException(ERRORS.CALL_INVALID_STATE);
    const toCaller = call.calleeId === userId;
    const targetId = toCaller ? call.callerId : call.calleeId;
    const targetPanel = ((toCaller ? call.callerPanel : call.calleePanel) as Panel | null) ?? null;
    await this.events.emit(targetId, targetPanel, 'call.signal', { callId, kind: dto.kind as SignalKind, payload: dto.payload });
    return { relayed: true };
  }

  // ---- ichki yordamchilar ----

  private peerPanel(roles: string[], callerPanel: Panel | null): Panel | null {
    const valid = roles.filter((role): role is Role => role === 'CUSTOMER' || role === 'MASTER');
    if (valid.length === 1) return valid[0]!;
    if (callerPanel === 'CUSTOMER' && valid.includes('MASTER')) return 'MASTER';
    if (callerPanel === 'MASTER' && valid.includes('CUSTOMER')) return 'CUSTOMER';
    return valid[0] ?? null;
  }

  private async requireParticipant(userId: string, callId: string): Promise<Call> {
    const call = await this.db.call.findUnique({ where: { id: callId } });
    if (!call || (call.callerId !== userId && call.calleeId !== userId)) throw new NotFoundException(ERRORS.CALL_NOT_FOUND);
    return call;
  }

  private async touch(callId: string, userId: string): Promise<void> {
    await this.redis.set(`callping:${callId}:${userId}`, '1', PING_TTL_SECONDS).catch(() => undefined);
  }

  /** Holatni atomik o‘tkazadi, ikkinchi tomonga xabar beradi, chat tarixiga yozadi. */
  private async finish(call: Call, actorId: string, from: CallStatus[], to: CallStatus, reason: string) {
    const result = await this.db.call.updateMany({ where: { id: call.id, status: { in: from } }, data: { status: to, endReason: reason, endedAt: new Date() } });
    if (result.count === 0) {
      const current = await this.db.call.findUniqueOrThrow({ where: { id: call.id } });
      // Ikkinchi tomon allaqachon tugatgan bo‘lsa — xato emas, joriy holat qaytariladi.
      if (!LIVE.includes(current.status)) return { call: toView(current) };
      throw new ConflictException(ERRORS.CALL_INVALID_STATE);
    }
    this.clearRingTimer(call.id);
    const updated = await this.db.call.findUniqueOrThrow({ where: { id: call.id }, include: { caller: { select: { id: true, firstName: true, lastName: true } } } });
    await this.afterEnd(updated, updated.caller, reason, actorId);
    return { call: toView(updated) };
  }

  private async afterEnd(call: Call, caller: { id: string; firstName: string | null; lastName: string | null }, reason: string, actorId?: string): Promise<void> {
    const seconds = call.answeredAt && call.endedAt ? Math.max(0, Math.round((call.endedAt.getTime() - call.answeredAt.getTime()) / 1000)) : 0;
    const payload = { callId: call.id, status: call.status, reason, seconds };
    const other = actorId === call.callerId ? { id: call.calleeId, panel: call.calleePanel } : { id: call.callerId, panel: call.callerPanel };
    // Ikkala tomonga ham (jumladan boshqa qurilmalariga): faqat kerakli panel oqimiga.
    await Promise.all([
      this.events.emit(other.id, (other.panel as Panel | null) ?? null, 'call.ended', payload),
      actorId ? this.events.emit(actorId, ((actorId === call.callerId ? call.callerPanel : call.calleePanel) as Panel | null) ?? null, 'call.ended', payload) : Promise.resolve(),
    ]).catch(() => undefined);

    // Chat tarixi: «Video qo‘ng‘iroq · 2:31» / «O‘tkazib yuborilgan qo‘ng‘iroq».
    try {
      await this.db.$transaction([
        this.db.message.create({
          data: {
            conversationId: call.conversationId,
            senderId: call.callerId,
            senderPanel: call.callerPanel,
            type: 'SYSTEM',
            text: `call:${JSON.stringify({ callId: call.id, mode: call.mode, status: call.status, seconds, callerId: call.callerId })}`,
          },
        }),
        this.db.conversation.update({ where: { id: call.conversationId }, data: { updatedAt: new Date() } }),
      ]);
    } catch (error) {
      this.logger.warn(`Qo‘ng‘iroq tarixi yozilmadi: ${(error as Error).message}`);
    }

    if (call.status === CallStatus.MISSED || call.status === CallStatus.CANCELED) {
      await this.notifications
        .create({
          userId: call.calleeId,
          channel: 'IN_APP',
          title: 'O‘tkazib yuborilgan qo‘ng‘iroq',
          body: `${nameOf(caller)} sizga ${call.mode === 'VIDEO' ? 'video' : 'audio'} qo‘ng‘iroq qildi.`,
          template: 'call.missed',
          data: { conversationId: call.conversationId, callId: call.id, mode: call.mode },
        })
        .catch((error: unknown) => this.logger.warn(`Qo‘ng‘iroq bildirishnomasi yuborilmadi: ${(error as Error).message}`));
    }
  }

  private armRingTimer(callId: string): void {
    this.clearRingTimer(callId);
    const ms = this.config.get<number>('webrtc.ringSeconds', 45) * 1000;
    this.ringTimers.set(
      callId,
      setTimeout(() => {
        this.ringTimers.delete(callId);
        void this.expire(callId).catch((error: unknown) => this.logger.warn(`Qo‘ng‘iroq muddati tugashi: ${(error as Error).message}`));
      }, ms),
    );
  }

  private clearRingTimer(callId: string): void {
    const timer = this.ringTimers.get(callId);
    if (timer) clearTimeout(timer);
    this.ringTimers.delete(callId);
  }

  /** Javob berilmagan qo‘ng‘iroq → «o‘tkazib yuborilgan». */
  private async expire(callId: string): Promise<void> {
    const call = await this.db.call.findUnique({ where: { id: callId } });
    if (!call || call.status !== CallStatus.RINGING) return;
    await this.finish(call, call.callerId, [CallStatus.RINGING], CallStatus.MISSED, 'no_answer').catch(() => undefined);
  }

  /** Server qayta ishga tushsa/taymer yo‘qolsa ham jiringlayotgan va osilib qolgan qo‘ng‘iroqlar tozalanadi. */
  @Cron('*/20 * * * * *')
  async sweep(): Promise<void> {
    const ring = this.config.get<number>('webrtc.ringSeconds', 45);
    const stale = await this.db.call.findMany({ where: { status: CallStatus.RINGING, createdAt: { lt: new Date(Date.now() - (ring + 5) * 1000) } }, take: 50 });
    for (const call of stale) await this.expire(call.id);
    const active = await this.db.call.findMany({ where: { status: CallStatus.ACTIVE, answeredAt: { lt: new Date(Date.now() - 90_000) } }, take: 50 });
    for (const call of active) {
      const alive = (await this.redis.get(`callping:${call.id}:${call.callerId}`).catch(() => null)) ?? (await this.redis.get(`callping:${call.id}:${call.calleeId}`).catch(() => null));
      if (!alive) await this.finish(call, call.callerId, [CallStatus.ACTIVE], CallStatus.ENDED, 'lost').catch(() => undefined);
    }
  }
}

