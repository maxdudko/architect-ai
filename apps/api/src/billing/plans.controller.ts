import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { PlanResponseDto } from './dto/plan-response.dto';

@ApiTags('Plans')
@Controller('plans')
export class PlansController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  @ApiOperation({
    summary: 'List active plans with their standard/BYOK prices',
  })
  listPlans(): Promise<PlanResponseDto[]> {
    return this.billingService.listPublicPlans();
  }
}
