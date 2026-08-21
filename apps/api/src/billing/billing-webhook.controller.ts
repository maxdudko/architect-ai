import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';
import { BillingService } from './billing.service';

@ApiExcludeController()
@Controller('billing/webhook')
export class BillingWebhookController {
  constructor(private readonly billingService: BillingService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ): Promise<{ received: true }> {
    if (!request.rawBody) {
      throw new BadRequestException('Missing raw request body');
    }
    if (!signature) {
      throw new BadRequestException('Missing Stripe-Signature header');
    }

    await this.billingService.handleWebhookEvent(request.rawBody, signature);
    return { received: true };
  }
}
