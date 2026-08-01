import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  GuideGenerationStatus,
  GuideGenerationTrigger,
  GuideType,
} from '@prisma/client';

export class GenerationRunResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  workspaceId!: string;

  @ApiProperty()
  repositoryId!: string;

  @ApiProperty({ enum: GuideGenerationTrigger })
  trigger!: GuideGenerationTrigger;

  @ApiProperty({ enum: GuideGenerationStatus })
  status!: GuideGenerationStatus;

  @ApiProperty({ enum: GuideType, isArray: true })
  requestedTypes!: GuideType[];

  @ApiProperty()
  totalGuideCount!: number;

  @ApiProperty()
  completedGuideCount!: number;

  @ApiPropertyOptional({ nullable: true })
  sourceIndexingRunId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  sourceCommitSha!: string | null;

  @ApiPropertyOptional({ nullable: true })
  error!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Structured generation errors, when available',
  })
  errors!: unknown;

  @ApiProperty({ example: '2026-07-31T18:00:00.000Z' })
  createdAt!: string;

  @ApiPropertyOptional({
    nullable: true,
    example: '2026-07-31T18:00:01.000Z',
  })
  startedAt!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: '2026-07-31T18:01:00.000Z',
  })
  completedAt!: string | null;

  @ApiProperty({ example: '2026-07-31T18:01:00.000Z' })
  updatedAt!: string;
}
