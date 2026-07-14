import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { MetricsInterceptor } from './metrics.interceptor';

/** Prometheus metrics: registry, scrape endpoint, and a global request interceptor (M6-07). */
@Global()
@Module({
  providers: [MetricsService, { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor }],
  controllers: [MetricsController],
  exports: [MetricsService],
})
export class MetricsModule {}
