import type { NextFunction, Request, Response } from 'express';
import type { MetricsService } from './metrics.service';
import type { RequestRateService } from './request-rate.service';

export function createMetricsMiddleware(metrics: MetricsService, requestRate: RequestRateService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const seconds = Number(process.hrtime.bigint() - start) / 1e9;
      const route = (req.route?.path as string | undefined) ?? 'unmatched';
      metrics.observeHttp(req.method, route, res.statusCode, seconds);
      requestRate.record();
    });
    next();
  };
}
