import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArchitectureOverviewGenerationStatus,
  ArchitectureOverviewGenerationTrigger,
  RepositoryStatus,
} from '@prisma/client';

export class ArchitectureOverviewRevisionDto {
  @ApiProperty()
  indexingRunId!: string;

  @ApiPropertyOptional({ nullable: true })
  branch!: string | null;

  @ApiPropertyOptional({ nullable: true })
  commitSha!: string | null;

  @ApiPropertyOptional({ nullable: true })
  completedAt!: string | null;
}

export class ArchitectureOverviewDocumentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  markdown!: string;

  @ApiPropertyOptional({ nullable: true })
  summary!: string | null;

  @ApiProperty({ type: ArchitectureOverviewRevisionDto })
  revision!: ArchitectureOverviewRevisionDto;

  @ApiProperty()
  generatedAt!: string;

  @ApiProperty()
  generationVersion!: number;

  @ApiProperty()
  stale!: boolean;

  @ApiProperty({ type: [String] })
  citedPaths!: string[];

  @ApiProperty()
  partial!: boolean;

  @ApiProperty()
  modulesAbsent!: boolean;
}

export class ArchitectureOverviewRunDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ArchitectureOverviewGenerationStatus })
  status!: ArchitectureOverviewGenerationStatus;

  @ApiProperty({ enum: ArchitectureOverviewGenerationTrigger })
  trigger!: ArchitectureOverviewGenerationTrigger;

  @ApiProperty()
  completedStep!: number;

  @ApiProperty()
  totalSteps!: number;

  @ApiPropertyOptional({ nullable: true })
  error!: string | null;

  @ApiPropertyOptional({
    type: ArchitectureOverviewRevisionDto,
    nullable: true,
  })
  revision!: ArchitectureOverviewRevisionDto | null;

  @ApiProperty()
  createdAt!: string;

  @ApiPropertyOptional({ nullable: true })
  startedAt!: string | null;

  @ApiPropertyOptional({ nullable: true })
  completedAt!: string | null;
}

export class SystemOverviewResponseDto {
  @ApiProperty()
  repositoryId!: string;

  @ApiProperty({ enum: RepositoryStatus })
  repositoryStatus!: RepositoryStatus;

  @ApiProperty()
  indexingAvailable!: boolean;

  @ApiProperty()
  generationAllowed!: boolean;

  @ApiProperty()
  rebuildInProgress!: boolean;

  @ApiPropertyOptional({
    type: ArchitectureOverviewRevisionDto,
    nullable: true,
  })
  latestRevision!: ArchitectureOverviewRevisionDto | null;

  @ApiPropertyOptional({
    type: ArchitectureOverviewDocumentDto,
    nullable: true,
  })
  overview!: ArchitectureOverviewDocumentDto | null;

  @ApiPropertyOptional({ type: ArchitectureOverviewRunDto, nullable: true })
  run!: ArchitectureOverviewRunDto | null;
}
