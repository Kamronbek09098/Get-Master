import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { RedisService } from '../../infrastructure/redis/redis.service';
import type { Panel } from '../../common/utils/panel';

const CHANNEL = 'gm:call-events';
const PRESENCE_TTL_SECONDS = 45;
const HEARTBEAT_MS = 20_000;

interface Client {
  id: string;
  userId: string;
  panel: Panel | null;
  res: Response;
  heartbeat: NodeJS.Timeout;
}

interface Envelope {
  userId: string;
  panel: Panel | null;
  event: string;
  data: unknown;
}

/**
 * Qo‘ng‘iroq hodisalari (SSE): har bir foydalanuvchi (va panel) uchun ochiq oqim. Hodisalar Redis orqali tarqatiladi,
 * shuning uchun bir nechta server nusxasi bo‘lsa ham to‘g‘ri oqimga yetib boradi.
 */
@Injectable()
export class CallEventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CallEventsService.name);
  private readonly clients = new Map<string, Set<Client>>();
  private unsubscribe: (() => Promise<void>) | null = null;

  constructor(private readonly redis: RedisService) {}

  async onModuleInit(): Promise<void> {
    try {
      this.unsubscribe = await this.redis.subscribe(CHANNEL, (message) => {
        try {
          this.dispatch(JSON.parse(message) as Envelope);
        } catch {
          /* buzuq xabar e’tiborsiz */
        }
      });
    } catch (error) {
      this.logger.warn(`Redis obunasi ishlamadi, hodisalar faqat shu nusxada tarqatiladi: ${(error as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const set of this.clients.values()) for (const client of set) this.close(client);
    await this.unsubscribe?.().catch(() => undefined);
  }

  private presenceKey(userId: string, panel: Panel | null): string {
    return `callpresence:${userId}:${panel ?? 'any'}`;
  }

  /** SSE oqimini ochadi (sarlavhalar, qayta ulanish oraliqi, yurak urishi). */
  attach(userId: string, panel: Panel | null, res: Response, onClose: () => void): Client {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    res.write('retry: 3000\n\n');

    const client: Client = {
      id: randomUUID(),
      userId,
      panel,
      res,
      heartbeat: setInterval(() => {
        if (res.writableEnded) return;
        res.write(': ping\n\n');
        void this.redis.set(this.presenceKey(userId, panel), '1', PRESENCE_TTL_SECONDS).catch(() => undefined);
      }, HEARTBEAT_MS),
    };
    let set = this.clients.get(userId);
    if (!set) this.clients.set(userId, (set = new Set()));
    set.add(client);
    void this.redis.set(this.presenceKey(userId, panel), '1', PRESENCE_TTL_SECONDS).catch(() => undefined);
    res.on('close', () => {
      this.detach(client);
      onClose();
    });
    return client;
  }

  private detach(client: Client): void {
    clearInterval(client.heartbeat);
    const set = this.clients.get(client.userId);
    set?.delete(client);
    if (set && set.size === 0) this.clients.delete(client.userId);
    const stillHere = [...(set ?? [])].some((item) => item.panel === client.panel);
    if (!stillHere) void this.redis.del(this.presenceKey(client.userId, client.panel)).catch(() => undefined);
  }

  private close(client: Client): void {
    clearInterval(client.heartbeat);
    if (!client.res.writableEnded) client.res.end();
  }

  write(client: Client, event: string, data: unknown): void {
    if (client.res.writableEnded) return;
    client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  /** Foydalanuvchi (panel bo‘yicha) hozir oqim ochib turibdimi — qo‘ng‘iroq qila olinadimi. */
  async isOnline(userId: string, panel: Panel | null): Promise<boolean> {
    try {
      // Panelsiz (sarlavhasiz) oqim har qanday panel uchun hisoblanadi.
      if (panel && (await this.redis.exists(this.presenceKey(userId, panel)))) return true;
      return await this.redis.exists(this.presenceKey(userId, null));
    } catch {
      return [...(this.clients.get(userId) ?? [])].some((client) => !panel || !client.panel || client.panel === panel);
    }
  }

  /** Hodisani foydalanuvchining (kerak bo‘lsa — faqat shu panel) barcha oqimlariga yetkazadi. */
  async emit(userId: string, panel: Panel | null, event: string, data: unknown): Promise<void> {
    const envelope: Envelope = { userId, panel, event, data };
    try {
      await this.redis.publish(CHANNEL, JSON.stringify(envelope));
    } catch {
      this.dispatch(envelope);
    }
  }

  private dispatch(envelope: Envelope): void {
    const set = this.clients.get(envelope.userId);
    if (!set) return;
    for (const client of set) {
      if (envelope.panel && client.panel && client.panel !== envelope.panel) continue;
      this.write(client, envelope.event, envelope.data);
    }
  }
}
