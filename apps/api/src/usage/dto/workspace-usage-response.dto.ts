import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UsageMetric, UsagePeriod } from '@prisma/client';

export class UsageMetricSnapshotDto {
  @ApiProperty({ enum: UsageMetric })
  metric!: UsageMetric;

  @ApiProperty({ enum: UsagePeriod })
  period!: UsagePeriod;

  @ApiProperty()
  used!: number;

  @ApiPropertyOptional({ nullable: true })
  limit!: number | null;

  @ApiPropertyOptional({ nullable: true })
  remaining!: number | null;
}

export class PlanSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  key!: string;

  @ApiProperty()
  name!: string;
}

export class WorkspaceUsageResponseDto {
  @ApiProperty()
  workspaceId!: string;

  @ApiProperty({ type: PlanSummaryDto })
  plan!: PlanSummaryDto;

  @ApiProperty({ enum: ['HOSTED', 'BYOK'] })
  aiMode!: 'HOSTED' | 'BYOK';

  @ApiProperty({ type: [UsageMetricSnapshotDto] })
  metrics!: UsageMetricSnapshotDto[];
}
