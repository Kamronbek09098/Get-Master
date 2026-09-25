import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) { const incoming = typeof req.headers['x-request-id'] === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(req.headers['x-request-id']) ? req.headers['x-request-id'] : randomUUID(); req.id = incoming; res.setHeader('x-request-id', incoming); next(); }
}
