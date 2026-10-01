import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RepositoryStatus, SymbolRelationType } from '@prisma/client';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { ARCHITECTURE_SEARCH_LIMITS } from '../architecture-search.constants';
import type {
  ArchitectureSearchIntent,
  EpistemicLabel,
} from '../architecture-search.constants';

export class AskArchitectureSearchDto {
  @ApiProperty({ example: 'What depends on Auth?' })
  @IsString()
  @MinLength(1)
  @MaxLength(ARCHITECTURE_SEARCH_LIMITS.questionMaxLength)
  content!: string;
}

export class ArchitectureSearchRevisionDto {
  @ApiProperty()
  indexingRunId!: string;

  @ApiPropertyOptional()
  branch!: string | null;

  @ApiPropertyOptional()
  commitSha!: string | null;

  @ApiPropertyOptional()
  completedAt!: string | null;
}

export class ArchitectureSearchBoundsDto {
  @ApiProperty()
  limit!: number;

  @ApiProperty()
  returned!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  truncated!: boolean;
}

export class ArchitectureSearchModuleRefDto {
  @ApiProperty()
  key!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  path!: string;
}

export class ArchitectureSearchEvidenceDto {
  @ApiProperty()
  repositoryId!: string;

  @ApiProperty()
  filePath!: string;

  @ApiPropertyOptional()
  startLine!: number | null;

  @ApiPropertyOptional()
  endLine!: number | null;

  @ApiPropertyOptional()
  name!: string | null;

  @ApiPropertyOptional()
  qualifiedName!: string | null;

  @ApiProperty({ enum: SymbolRelationType })
  relationType!: SymbolRelationType;
}

export class ArchitectureSearchFindingDto {
  @ApiProperty({ enum: ['DEPENDENCY', 'DEPENDENT'] })
  direction!: 'DEPENDENCY' | 'DEPENDENT';

  @ApiProperty()
  moduleKey!: string;

  @ApiProperty()
  moduleName!: string;

  @ApiProperty()
  relatedModuleKey!: string;

  @ApiProperty()
  relatedModuleName!: string;

  @ApiProperty({ enum: SymbolRelationType, isArray: true })
  relationTypes!: SymbolRelationType[];

  @ApiProperty()
  supportingRelationCount!: number;

  @ApiProperty({ enum: ['RESOLVED'] })
  confidence!: 'RESOLVED';

  @ApiProperty({ enum: ['OBSERVED'] })
  epistemic!: 'OBSERVED';

  @ApiProperty({ type: [ArchitectureSearchEvidenceDto] })
  evidence!: ArchitectureSearchEvidenceDto[];
}

export class ArchitectureSearchEntityResolutionDto {
  @ApiProperty({ enum: ['RESOLVED', 'AMBIGUOUS', 'NOT_FOUND', 'NONE'] })
  outcome!: 'RESOLVED' | 'AMBIGUOUS' | 'NOT_FOUND' | 'NONE';

  @ApiPropertyOptional()
  query!: string | null;

  @ApiPropertyOptional({ type: ArchitectureSearchModuleRefDto })
  module!: ArchitectureSearchModuleRefDto | null;

  @ApiProperty({ type: [ArchitectureSearchModuleRefDto] })
  candidates!: ArchitectureSearchModuleRefDto[];

  @ApiProperty({ type: ArchitectureSearchBoundsDto })
  candidateBounds!: ArchitectureSearchBoundsDto;
}

export class ArchitectureSearchRetrievedEvidenceDto {
  @ApiProperty()
  repositoryId!: string;

  @ApiProperty()
  filePath!: string;

  @ApiPropertyOptional()
  startLine!: number | null;

  @ApiPropertyOptional()
  endLine!: number | null;

  @ApiPropertyOptional()
  name!: string | null;

  @ApiPropertyOptional()
  qualifiedName!: string | null;

  @ApiProperty({ enum: ['INTERPRETED'] })
  epistemic!: 'INTERPRETED';
}

export class ArchitectureSearchAnswerDto {
  @ApiProperty()
  conversationId!: string;

  @ApiProperty()
  userMessageId!: string;

  @ApiProperty()
  assistantMessageId!: string;

  @ApiProperty()
  repositoryId!: string;

  @ApiProperty({ enum: RepositoryStatus })
  repositoryStatus!: RepositoryStatus;

  @ApiProperty({ type: ArchitectureSearchRevisionDto })
  revision!: ArchitectureSearchRevisionDto;

  @ApiProperty()
  rebuildInProgress!: boolean;

  @ApiProperty()
  historical!: boolean;

  @ApiProperty()
  intent!: ArchitectureSearchIntent;

  @ApiProperty()
  epistemic!: EpistemicLabel;

  @ApiProperty()
  content!: string;

  @ApiProperty()
  truncated!: boolean;

  @ApiProperty()
  contextTruncated!: boolean;

  @ApiProperty({ type: [ArchitectureSearchFindingDto] })
  findings!: ArchitectureSearchFindingDto[];

  @ApiProperty({ type: ArchitectureSearchBoundsDto })
  dependencyBounds!: ArchitectureSearchBoundsDto;

  @ApiProperty({ type: ArchitectureSearchBoundsDto })
  dependentBounds!: ArchitectureSearchBoundsDto;

  @ApiProperty({ type: ArchitectureSearchEntityResolutionDto })
  entityResolution!: ArchitectureSearchEntityResolutionDto;

  @ApiProperty({ type: [ArchitectureSearchRetrievedEvidenceDto] })
  retrievedEvidence!: ArchitectureSearchRetrievedEvidenceDto[];

  @ApiProperty({ type: [String] })
  limitations!: string[];

  @ApiPropertyOptional({ enum: ['HELPFUL', 'NOT_HELPFUL'] })
  feedbackRating!: 'HELPFUL' | 'NOT_HELPFUL' | null;
}

export class ArchitectureSearchTurnDto {
  @ApiProperty()
  question!: string;

  @ApiProperty()
  askedAt!: string;

  @ApiPropertyOptional({ type: ArchitectureSearchAnswerDto })
  answer!: ArchitectureSearchAnswerDto | null;
}

export class ArchitectureSearchThreadDto {
  @ApiPropertyOptional()
  conversationId!: string | null;

  @ApiProperty()
  repositoryId!: string;

  @ApiProperty({ enum: RepositoryStatus })
  repositoryStatus!: RepositoryStatus;

  @ApiProperty()
  indexingAvailable!: boolean;

  @ApiPropertyOptional({ type: ArchitectureSearchRevisionDto })
  latestRevision!: ArchitectureSearchRevisionDto | null;

  @ApiProperty()
  rebuildInProgress!: boolean;

  @ApiProperty({ type: [ArchitectureSearchTurnDto] })
  turns!: ArchitectureSearchTurnDto[];
}
