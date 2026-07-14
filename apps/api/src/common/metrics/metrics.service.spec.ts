import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  it('renders Prometheus text exposition with the service label and HTTP metrics', async () => {
    const svc = new MetricsService();
    svc.httpRequests.inc({ method: 'GET', route: '/groups/:id', status: '200' });
    const out = await svc.render();
    expect(out).toContain('http_requests_total');
    expect(out).toContain('service="splitsmart-api"');
    expect(out).toContain('route="/groups/:id"');
    // Default process metrics are registered too.
    expect(out).toContain('process_cpu_user_seconds_total');
  });

  it('records latency observations into the duration histogram', async () => {
    const svc = new MetricsService();
    const stop = svc.httpDuration.startTimer({ method: 'POST', route: '/x' });
    stop();
    const out = await svc.render();
    expect(out).toContain('http_request_duration_seconds_bucket');
  });
});
