import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BillingInterval,
  BillingMode,
  UsageMetric,
  UsagePeriod,
} from '@prisma/client';

export class AdminPlanPriceDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: BillingMode })
  billingMode!: BillingMode;

  @ApiProperty({ enum: BillingInterval })
  interval!: BillingInterval;

  @ApiProperty()
  amount!: number;

  @ApiProperty()
  currency!: string;

  @ApiPropertyOptional({ nullable: true })
  stripePriceId!: string | null;
}

export class AdminPlanLimitDto {
  @ApiProperty({ enum: UsageMetric })
  metric!: UsageMetric;

  @ApiProperty({ enum: UsagePeriod })
  period!: UsagePeriod;

  @ApiPropertyOptional({ nullable: true })
  maxValue!: number | null;
}

export class AdminPlanDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  key!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty()
  isContactSales!: boolean;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  sortOrder!: number;

  @ApiProperty({ type: [AdminPlanPriceDto] })
  prices!: AdminPlanPriceDto[];

  @ApiProperty({ type: [AdminPlanLimitDto] })
  limits!: AdminPlanLimitDto[];
}
