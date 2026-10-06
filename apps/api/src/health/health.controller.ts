import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@smd/shared';

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'social-media-dashboard-api',
      timestamp: new Date().toISOString(),
    };
  }
}
