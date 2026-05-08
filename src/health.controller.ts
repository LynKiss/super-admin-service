import { Controller, Get } from '@nestjs/common';
import { Public } from './decorators/current-user.decorator';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return {
      ok: true,
      service: 'super-admin-service',
      timestamp: new Date().toISOString(),
    };
  }
}
