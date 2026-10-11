import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RawResponse } from '../../common/decorators/raw-response.decorator';

const UPSTREAM = 'https://tiles.openfreemap.org';
/** Faqat xarita fayllari: uslub, vektor plitkalar, shriftlar, belgilar, fon rasmi. */
const ALLOWED = /^(styles\/[\w-]+|planet(\/[\w.-]+)?(\/\d+\/\d+\/\d+\.pbf)?|fonts\/[^/]+\/\d+-\d+\.pbf|sprites\/[\w.-]+\/[\w@.-]+\.(json|png)|natural_earth\/[\w-]+\/\d+\/\d+\/\d+\.png)$/;
const MAX_ENTRIES = 3000;
const MAX_BYTES = 96 * 1024 * 1024;

interface Entry { body: Buffer; type: string; at: number }

/**
 * Xarita proksisi (OpenFreeMap). Telefon ilovasi xarita fayllarini to‘g‘ridan-to‘g‘ri tashqi serverdan ololmasligi mumkin (tarmoq cheklovi);
 * ular ilovaning o‘z API manzili orqali beriladi va serverda keshlanadi.
 */
@Controller('geo/map')
export class MapProxyController {
  private readonly cache = new Map<string, Entry>();
  private bytes = 0;

  @Public()
  @RawResponse()
  @RateLimit({ scope: 'ip', limit: 9000, windowSeconds: 60 })
  @Get('*path')
  async get(@Req() req: Request, @Res() res: Response) {
    const full = req.originalUrl.split('/geo/map/')[1] ?? '';
    const [rawPath = ''] = full.split('?');
    let path: string;
    try {
      path = decodeURIComponent(rawPath);
    } catch {
      res.status(400).end();
      return;
    }
    if (path.includes('..') || !ALLOWED.test(path)) {
      res.status(404).end();
      return;
    }
    const upstreamUrl = `${UPSTREAM}/${rawPath}`;
    let entry = this.cache.get(upstreamUrl);
    if (!entry) {
      try {
        const response = await fetch(upstreamUrl, { signal: AbortSignal.timeout(15_000), headers: { 'User-Agent': 'GetMaster/1.0' } });
        if (!response.ok) {
          res.status(response.status === 404 ? 404 : 502).end();
          return;
        }
        let body: Buffer = Buffer.from(await response.arrayBuffer());
        const type = response.headers.get('content-type') ?? 'application/octet-stream';
        if (type.includes('json')) {
          const base = `${req.protocol}://${req.get('host')}/api/v1/geo/map`;
          body = Buffer.from(body.toString('utf8').split(UPSTREAM).join(base), 'utf8');
        }
        entry = { body, type, at: Date.now() };
        this.remember(upstreamUrl, entry);
      } catch {
        res.status(502).end();
        return;
      }
    }
    // JSON (uslub/TileJSON) manzili so‘rov hostiga bog‘liq — keshda host bilan birga saqlanmasligi uchun JSON keshlanmaydi.
    if (entry.type.includes('json')) this.cache.delete(upstreamUrl);
    res.setHeader('Content-Type', entry.type);
    res.setHeader('Cache-Control', entry.type.includes('json') ? 'public, max-age=300' : 'public, max-age=86400');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(entry.body);
  }

  private remember(key: string, entry: Entry) {
    if (entry.type.includes('json')) return;
    this.cache.set(key, entry);
    this.bytes += entry.body.length;
    while (this.cache.size > MAX_ENTRIES || this.bytes > MAX_BYTES) {
      const oldest = this.cache.keys().next().value as string | undefined;
      if (!oldest) break;
      this.bytes -= this.cache.get(oldest)?.body.length ?? 0;
      this.cache.delete(oldest);
    }
  }
}
