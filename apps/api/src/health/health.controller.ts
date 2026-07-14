import { Controller, Get } from '@nestjs/common';
import type { HealthStatus } from '@splitsmart/types';
import { SkipRateLimit } from '../common/rate-limit/rate-limit.decorator';

@Controller('health')
export class HealthController {
  @Get()
  @SkipRateLimit()
  check(): HealthStatus {
    return {
      status: 'ok',
      service: 'splitsmart-api',
      timestamp: new Date().toISOString(),
    };
  }
}
