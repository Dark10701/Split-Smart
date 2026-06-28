import { Controller, Get } from '@nestjs/common';
import type { HealthStatus } from '@splitsmart/types';

@Controller('health')
export class HealthController {
  @Get()
  check(): HealthStatus {
    return {
      status: 'ok',
      service: 'splitsmart-api',
      timestamp: new Date().toISOString(),
    };
  }
}
