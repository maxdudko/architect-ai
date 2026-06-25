import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

@ApiExcludeController()
@Controller()
export class AppController {
  @Get('health')
  getHealth(): { status: string; service: string; summary: string } {
    const health = { status: 'ok' as const, service: 'api' };
    return { ...health, summary: `${health.service}:${health.status}` };
  }
}
