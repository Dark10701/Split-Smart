import { Controller, Get, Header } from '@nestjs/common';
import { SkipRateLimit } from '../rate-limit/rate-limit.decorator';
import { MetricsService } from './metrics.service';

/** Prometheus scrape endpoint (M6-07). Unauthenticated + rate-limit exempt so a
 * scraper can poll it freely; exposes only aggregate counters, no user data. */
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @SkipRateLimit()
  @Header('Content-Type', 'text/plain; version=0.0.4')
  async scrape(): Promise<string> {
    return this.metrics.render();
  }
}
