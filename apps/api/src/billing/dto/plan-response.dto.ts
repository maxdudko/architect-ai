import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BillingInterval,
  BillingMode,
  IndexingResourceMetric,
  UsageMetric,
  UsagePeriod,
} from '@prisma/client';

export class PlanPriceResponseDto {
  @ApiProperty({ enum: BillingMode })
  billingMode!: BillingMode;

  @ApiProperty({ enum: BillingInterval })
  interval!: BillingInterval;

  @ApiProperty({
    description: 'Price in the smallest currency unit (e.g. cents)',
  })
  amount!: number;

  @ApiProperty()
  currency!: string;
}

export class PlanLimitResponseDto {
  @ApiProperty({ enum: UsageMetric })
  metric!: UsageMetric;

  @ApiProperty({ enum: UsagePeriod })
  period!: UsagePeriod;

  @ApiPropertyOptional({ nullable: true })
  maxValue!: number | null;
}

export class PlanIndexingLimitResponseDto {
  @ApiProperty({ enum: IndexingResourceMetric })
  metric!: IndexingResourceMetric;

  @ApiPropertyOptional({ nullable: true })
  maxValue!: number | null;
}

export class PlanResponseDto {
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
  sortOrder!: number;

  @ApiProperty({ type: [PlanPriceResponseDto] })
  prices!: PlanPriceResponseDto[];

  @ApiProperty({ type: [PlanLimitResponseDto] })
  limits!: PlanLimitResponseDto[];

  @ApiProperty({ type: [PlanIndexingLimitResponseDto] })
  indexingLimits!: PlanIndexingLimitResponseDto[];
}
