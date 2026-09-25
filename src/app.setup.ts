import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { createValidationPipe } from './common/pipes/validation.pipe';
import { MetricsService } from './infrastructure/metrics/metrics.service';
import { createMetricsMiddleware } from './infrastructure/metrics/metrics.middleware';

(BigInt.prototype as unknown as { toJSON(): number }).toJSON = function toJSON() {
  return Number(this);
};

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api/v1');
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });
  app.enableShutdownHooks();
  if (config.get<boolean>('app.trustProxy', false)) {
    (app.getHttpAdapter().getInstance() as { set(key: string, value: boolean): void }).set('trust proxy', true);
  }
  const requestIdMiddleware = new RequestIdMiddleware();
  app.use(requestIdMiddleware.use.bind(requestIdMiddleware));
  app.use(createMetricsMiddleware(app.get(MetricsService)));

  const origins = config.get<string[]>('app.corsOrigins', []);
  app.enableCors({
    origin: origins.length ? origins : false,
    credentials: true,
  });

  app.useGlobalPipes(createValidationPipe());
}
