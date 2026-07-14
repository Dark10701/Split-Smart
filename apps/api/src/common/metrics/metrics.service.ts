import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

/**
 * Prometheus metrics registry (M6-07). Exposes default process/runtime metrics
 * plus per-route HTTP request counts and latency, scraped at `GET /metrics`.
 */
@Injectable()
export class MetricsService {
  readonly registry = new Registry();
  readonly httpRequests: Counter<'method' | 'route' | 'status'>;
  readonly httpDuration: Histogram<'method' | 'route'>;

  constructor() {
    this.registry.setDefaultLabels({ service: 'splitsmart-api' });
    collectDefaultMetrics({ register: this.registry });

    this.httpRequests = new Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests, labelled by method, route template, and status.',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });
    this.httpDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request latency in seconds, labelled by method and route.',
      labelNames: ['method', 'route'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });
  }

  async render(): Promise<string> {
    return this.registry.metrics();
  }
}
