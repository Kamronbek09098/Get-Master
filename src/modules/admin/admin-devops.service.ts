import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { RequestRateService, TrafficWindow } from '../../infrastructure/metrics/request-rate.service';

const execFileAsync = promisify(execFile);

export interface PingResult {
  ok: boolean;
  latencyMs: number | null;
}

export interface DiskUsage {
  totalGB: number;
  usedGB: number;
  freeGB: number;
  usedPercent: number;
}

/** Ilova va server holatini (CPU/RAM/disk, Node jarayoni, versiya, DB/Redis ulanishi, trafik) real vaqtda o'qiydi — admin "DevOps" sahifasi uchun. */
@Injectable()
export class AdminDevopsService {
  private readonly startedAt = Date.now();

  constructor(
    private readonly db: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly requestRate: RequestRateService,
  ) {}

  async snapshot(window: TrafficWindow) {
    const [cpuPercent, disk, database, redisStatus] = await Promise.all([
      this.cpuUsagePercent(),
      this.diskUsage(),
      this.pingDatabase(),
      this.pingRedis(),
    ]);

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usedMemPercent = Math.round((usedMem / totalMem) * 100);

    const appVersion = this.readVersion();
    const commit = await this.gitCommit();
    const environment = this.config.get<string>('app.environment', 'development');
    const telegramConfigured = !!this.config.get<string>('telegram.botToken') && !!this.config.get<string>('telegram.chatId');
    const metricsTokenSet = !!process.env.METRICS_TOKEN;

    const mem = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const backup = {
      configured: false,
      message: 'Avtomatik zaxira nusxalash hali sozlanmagan. PostgreSQL uchun kunlik pg_dump va masofaviy saqlash tavsiya etiladi.',
    };

    const issues: Array<{ level: 'warning' | 'danger'; message: string }> = [];
    if (usedMemPercent >= 90) issues.push({ level: 'warning', message: `Xotira (RAM) ${usedMemPercent}% band` });
    if (disk && disk.usedPercent >= 90) issues.push({ level: 'warning', message: `Disk ${disk.usedPercent}% to‘lgan` });
    if (!backup.configured) issues.push({ level: 'warning', message: 'Zaxira nusxa sozlanmagan' });
    if (environment === 'production' && !metricsTokenSet) {
      issues.push({ level: 'danger', message: 'Production muhitida METRICS_TOKEN o‘rnatilmagan — /metrics ochiq qolishi mumkin' });
    }
    if (!database.ok) issues.push({ level: 'danger', message: 'Ma’lumotlar bazasiga ulanib bo‘lmadi' });
    if (!redisStatus.ok) issues.push({ level: 'danger', message: 'Redis’ga ulanib bo‘lmadi' });

    return {
      checkedAt: new Date().toISOString(),
      issues,
      system: {
        hostname: os.hostname(),
        platform: `${os.type()} ${os.release()}`,
        cpuCount: os.cpus().length,
        cpuPercent,
        loadAvg: os.loadavg().map((value) => Math.round(value * 100) / 100),
        totalMemMB: Math.round(totalMem / 1024 / 1024),
        freeMemMB: Math.round(freeMem / 1024 / 1024),
        usedMemPercent,
        uptimeSeconds: Math.round(os.uptime()),
        disk,
      },
      process: {
        pid: process.pid,
        nodeVersion: process.version,
        uptimeSeconds: Math.round(process.uptime()),
        rssMB: Math.round(mem.rss / 1024 / 1024),
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        cpuUserMs: Math.round(cpuUsage.user / 1000),
        cpuSystemMs: Math.round(cpuUsage.system / 1000),
      },
      version: {
        appVersion,
        commit,
        environment,
        nodeVersion: process.version,
        startedAt: new Date(this.startedAt).toISOString(),
      },
      dependencies: {
        database,
        redis: redisStatus,
        telegramAlerting: telegramConfigured,
      },
      backup,
      traffic: this.requestRate.series(window),
    };
  }

  private async cpuUsagePercent(sampleMs = 200): Promise<number> {
    const start = os.cpus();
    await new Promise((resolve) => setTimeout(resolve, sampleMs));
    const end = os.cpus();
    let idleDiff = 0;
    let totalDiff = 0;
    for (let i = 0; i < start.length; i++) {
      const s = start[i]!.times;
      const e = end[i]!.times;
      const sTotal = s.user + s.nice + s.sys + s.idle + s.irq;
      const eTotal = e.user + e.nice + e.sys + e.idle + e.irq;
      idleDiff += e.idle - s.idle;
      totalDiff += eTotal - sTotal;
    }
    return totalDiff === 0 ? 0 : Math.round((1 - idleDiff / totalDiff) * 100);
  }

  private async diskUsage(): Promise<DiskUsage | null> {
    try {
      const { stdout } = await execFileAsync('df', ['-Pk', '/']);
      const lines = stdout.trim().split('\n');
      const parts = lines[lines.length - 1]!.trim().split(/\s+/);
      const totalKB = Number(parts[1]);
      const usedKB = Number(parts[2]);
      const freeKB = Number(parts[3]);
      if (!Number.isFinite(totalKB) || totalKB === 0) return null;
      return {
        totalGB: Math.round((totalKB / 1024 / 1024) * 10) / 10,
        usedGB: Math.round((usedKB / 1024 / 1024) * 10) / 10,
        freeGB: Math.round((freeKB / 1024 / 1024) * 10) / 10,
        usedPercent: Math.round((usedKB / totalKB) * 100),
      };
    } catch {
      return null;
    }
  }

  private async pingDatabase(): Promise<PingResult> {
    const start = Date.now();
    try {
      await this.db.$queryRaw`SELECT 1`;
      return { ok: true, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: null };
    }
  }

  private async pingRedis(): Promise<PingResult> {
    const start = Date.now();
    try {
      const ok = await this.redis.ping();
      return { ok, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: null };
    }
  }

  private readVersion(): string {
    try {
      const raw = fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8');
      return (JSON.parse(raw) as { version?: string }).version ?? '—';
    } catch {
      return '—';
    }
  }

  private async gitCommit(): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync('git', ['rev-parse', '--short', 'HEAD'], { cwd: process.cwd() });
      return stdout.trim() || null;
    } catch {
      return null;
    }
  }
}
