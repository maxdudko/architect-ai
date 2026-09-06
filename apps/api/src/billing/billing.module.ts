import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RolesGuard } from '../common/guards/roles.guard';
import { WorkspaceParamGuard } from '../common/guards/workspace-param.guard';
import { MembershipsModule } from '../memberships/memberships.module';
import { BillingWebhookController } from './billing-webhook.controller';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PlansController } from './plans.controller';
import { stripeClientProvider } from './stripe-client.provider';

@Module({
  imports: [ConfigModule, MembershipsModule],
  controllers: [BillingController, BillingWebhookController, PlansController],
  providers: [
    BillingService,
    stripeClientProvider,
    WorkspaceParamGuard,
    RolesGuard,
  ],
  exports: [BillingService],
})
export class BillingModule {}
