import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingMode, SubscriptionStatus } from '@prisma/client';

export class WorkspaceBillingPlanDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  key!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  isContactSales!: boolean;
}

export class WorkspaceBillingResponseDto {
  @ApiProperty({ type: WorkspaceBillingPlanDto })
  plan!: WorkspaceBillingPlanDto;

  @ApiProperty({ enum: BillingMode })
  billingMode!: BillingMode;

  @ApiPropertyOptional({ enum: SubscriptionStatus, nullable: true })
  status!: SubscriptionStatus | null;

  @ApiPropertyOptional({ nullable: true })
  currentPeriodEnd!: string | null;

  @ApiProperty()
  cancelAtPeriodEnd!: boolean;

  @ApiProperty({
    description:
      'Whether this workspace has a Stripe customer and can open the billing portal',
  })
  hasBillingAccount!: boolean;
}
