import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GuideType } from '@prisma/client';

export class OnboardingGuideResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  workspaceId!: string;

  @ApiProperty()
  repositoryId!: string;

  @ApiProperty({ enum: GuideType })
  type!: GuideType;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  markdown!: string;

  @ApiPropertyOptional({ nullable: true })
  summary!: string | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Guide-specific source references and structured metadata',
  })
  metadata!: unknown;

  @ApiProperty()
  generationVersion!: number;

  @ApiPropertyOptional({ nullable: true })
  sourceIndexingRunId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  sourceCommitSha!: string | null;

  @ApiProperty({ example: '2026-07-31T18:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-07-31T18:00:00.000Z' })
  updatedAt!: string;
}

export class OnboardingGuideListResponseDto {
  @ApiProperty({ type: [OnboardingGuideResponseDto] })
  guides!: OnboardingGuideResponseDto[];

  @ApiProperty()
  total!: number;
}
