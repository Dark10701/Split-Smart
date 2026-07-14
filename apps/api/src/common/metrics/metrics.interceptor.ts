import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

/**
 * Records per-request HTTP metrics (M6-07). Labels by the route *template*
 * (e.g. `/groups/:id/expenses`), not the concrete path, so high-cardinality
 * ids never explode the metric series.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const route = this.routeTemplate(req);
    const stop = this.metrics.httpDuration.startTimer({ method: req.method, route });

    return next.handle().pipe(
      tap({
        next: () => this.record(req.method, route, res.statusCode, stop),
        error: (err: { status?: number }) =>
          this.record(req.method, route, err?.status ?? 500, stop),
      }),
    );
  }

  private record(method: string, route: string, status: number, stop: () => void): void {
    stop();
    this.metrics.httpRequests.inc({ method, route, status: String(status) });
  }

  /** Prefer the matched Express route path; fall back to the raw path. */
  private routeTemplate(req: Request): string {
    const routePath = (req as Request & { route?: { path?: string } }).route?.path;
    const base = (req.baseUrl ?? '') + (routePath ?? req.path ?? 'unknown');
    return base || 'unknown';
  }
}
