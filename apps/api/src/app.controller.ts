import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth(): { status: string; service: string; summary: string } {
    const health = { status: 'ok' as const, service: 'api' };
    return { ...health, summary: `${health.service}:${health.status}` };
  }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
