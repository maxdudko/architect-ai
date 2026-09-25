import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RepositoryStatus, SymbolRelationType } from '@prisma/client';
import type {
  DependencyConfidence,
  ResolutionStrategy,
  UnresolvedReason,
} from '../types/dependency-graph.type';
import { ArchitectureSourceReferenceDto } from './architecture-source-reference.dto';

/**
 * The state a dependency view is in (spec section 10). The surface renders one
 * of these instead of an empty graph that would imply independence.
 */
export type DependencyMapState =
  | 'READY'
  | 'NO_INDEX'
  | 'REBUILDING'
  | 'NO_MODULES'
  | 'NO_DEPENDENCIES'
  | 'PARTIAL';

export const DEPENDENCY_MAP_STATES: DependencyMapState[] = [
  'READY',
  'NO_INDEX',
  'REBUILDING',
  'NO_MODULES',
  'NO_DEPENDENCIES',
  'PARTIAL',
];

/** Identifies the revision a view was derived from (spec FR-10, IR-1). */
export class ArchitectureRevisionDto {
  @ApiProperty()
  indexingRunId!: string;

  @ApiPropertyOptional()
  branch?: string | null;

  @ApiPropertyOptional()
  commitSha?: string | null;

  @ApiPropertyOptional({ example: '2026-06-24T00:00:00.000Z' })
  completedAt?: string | null;
}

/** Discloses that a returned set was bounded and by how much (spec UI-7). */
export class BoundDisclosureDto {
  @ApiProperty({ description: 'The declared maximum for this set.' })
  limit!: number;

  @ApiProperty()
  returned!: number;

  @ApiProperty({ description: 'How many items exist in total.' })
  total!: number;

  @ApiProperty()
  truncated!: boolean;
}

export class ModuleSummaryDto {
  @ApiProperty()
  key!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  path!: string;

  @ApiProperty()
  fileCount!: number;

  @ApiProperty()
  symbolCount!: number;

  @ApiProperty({ type: [String] })
  languages!: string[];

  @ApiProperty()
  outgoingDependencyCount!: number;

  @ApiProperty()
  incomingDependencyCount!: number;

  @ApiProperty({
    description:
      'Resolved import relationships whose target is inside this same module.',
  })
  internalRelationCount!: number;

  @ApiProperty()
  unresolvedRelationCount!: number;

  @ApiProperty()
  externalRelationCount!: number;

  @ApiProperty({
    description:
      'Deterministic ordering score: files plus symbols plus dependency degree.',
  })
  significance!: number;
}

export class ModuleExclusionDto {
  @ApiProperty()
  reason!: string;

  @ApiProperty()
  fileCount!: number;
}

export class NonDependencyRelationCountDto {
  @ApiProperty({ enum: SymbolRelationType })
  relationType!: SymbolRelationType;

  @ApiProperty()
  count!: number;
}

export class DependencyMapTotalsDto {
  @ApiProperty()
  moduleCount!: number;

  @ApiProperty()
  dependencyCount!: number;

  @ApiProperty()
  resolvedRelationCount!: number;

  @ApiProperty()
  unresolvedRelationCount!: number;

  @ApiProperty()
  externalRelationCount!: number;

  @ApiProperty()
  internalRelationCount!: number;

  @ApiProperty()
  groupedFileCount!: number;

  @ApiProperty()
  excludedFileCount!: number;
}

export class DependencyMapResponseDto {
  @ApiProperty()
  repositoryId!: string;

  @ApiProperty({ enum: RepositoryStatus })
  repositoryStatus!: RepositoryStatus;

  @ApiProperty({ enum: DEPENDENCY_MAP_STATES })
  state!: DependencyMapState;

  @ApiPropertyOptional({ type: ArchitectureRevisionDto })
  revision!: ArchitectureRevisionDto | null;

  @ApiProperty({
    description:
      'True when a newer indexing run is in progress. The view stays on the last successful revision.',
  })
  rebuildInProgress!: boolean;

  @ApiProperty({ type: [ModuleSummaryDto] })
  modules!: ModuleSummaryDto[];

  @ApiProperty({ type: BoundDisclosureDto })
  moduleBounds!: BoundDisclosureDto;

  @ApiProperty({
    description:
      'True when the graph exceeds the declared bounds, so only focused exploration is offered.',
  })
  focusedExplorationRequired!: boolean;

  @ApiProperty({ type: DependencyMapTotalsDto })
  totals!: DependencyMapTotalsDto;

  @ApiProperty({ type: [ModuleExclusionDto] })
  exclusions!: ModuleExclusionDto[];

  @ApiProperty({ type: [NonDependencyRelationCountDto] })
  nonDependencyRelationCounts!: NonDependencyRelationCountDto[];

  @ApiProperty({ type: [String] })
  groupingRules!: string[];

  @ApiProperty({ type: [String] })
  limitations!: string[];

  @ApiProperty()
  partial!: boolean;

  @ApiProperty({ type: [String] })
  partialReasons!: string[];
}

export class ModuleDependencyDto {
  @ApiProperty()
  fromModuleKey!: string;

  @ApiProperty()
  toModuleKey!: string;

  @ApiProperty({
    description:
      'The module at the other end of this dependency, relative to the selected module.',
  })
  relatedModuleKey!: string;

  @ApiProperty()
  relatedModuleName!: string;

  @ApiProperty({ enum: SymbolRelationType, isArray: true })
  relationTypes!: SymbolRelationType[];

  @ApiProperty()
  supportingRelationCount!: number;

  @ApiProperty({ enum: ['RESOLVED', 'UNRESOLVED', 'EXTERNAL'] })
  confidence!: DependencyConfidence;

  @ApiProperty()
  evidenceAvailable!: number;

  @ApiProperty()
  evidenceTruncated!: boolean;
}

export class UnresolvedRelationshipDto {
  @ApiProperty()
  moduleKey!: string;

  @ApiProperty()
  sourceFilePath!: string;

  @ApiPropertyOptional({
    description: 'The target path as written in source, when one was recorded.',
  })
  observedTarget?: string | null;

  @ApiPropertyOptional({ description: 'The target name as written in source.' })
  targetName?: string | null;

  @ApiProperty({ enum: SymbolRelationType })
  relationType!: SymbolRelationType;

  @ApiProperty()
  reason!: UnresolvedReason;

  @ApiProperty()
  reasonDescription!: string;

  @ApiProperty()
  occurrenceCount!: number;

  @ApiProperty({ enum: ['RESOLVED', 'UNRESOLVED', 'EXTERNAL'] })
  confidence!: DependencyConfidence;
}

export class ExternalDependencyDto {
  @ApiProperty()
  moduleKey!: string;

  @ApiProperty()
  targetName!: string;

  @ApiProperty({ enum: SymbolRelationType })
  relationType!: SymbolRelationType;

  @ApiProperty()
  occurrenceCount!: number;

  @ApiProperty({ enum: ['RESOLVED', 'UNRESOLVED', 'EXTERNAL'] })
  confidence!: DependencyConfidence;
}

export class ModuleFileDto {
  @ApiProperty()
  path!: string;

  @ApiProperty()
  language!: string;

  @ApiProperty()
  lineCount!: number;
}

export class ModuleSymbolDto {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  qualifiedName!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  filePath!: string;

  @ApiProperty()
  language!: string;

  @ApiProperty()
  startLine!: number;

  @ApiProperty()
  endLine!: number;
}

export class ModuleDetailResponseDto {
  @ApiProperty()
  repositoryId!: string;

  @ApiProperty({ type: ArchitectureRevisionDto })
  revision!: ArchitectureRevisionDto;

  @ApiProperty({ type: ModuleSummaryDto })
  module!: ModuleSummaryDto;

  @ApiProperty({ type: [ModuleDependencyDto] })
  dependencies!: ModuleDependencyDto[];

  @ApiProperty({ type: BoundDisclosureDto })
  dependencyBounds!: BoundDisclosureDto;

  @ApiProperty({ type: [ModuleDependencyDto] })
  dependents!: ModuleDependencyDto[];

  @ApiProperty({ type: BoundDisclosureDto })
  dependentBounds!: BoundDisclosureDto;

  @ApiProperty({ type: [UnresolvedRelationshipDto] })
  unresolved!: UnresolvedRelationshipDto[];

  @ApiProperty({ type: BoundDisclosureDto })
  unresolvedBounds!: BoundDisclosureDto;

  @ApiProperty({ type: [ExternalDependencyDto] })
  external!: ExternalDependencyDto[];

  @ApiProperty({ type: BoundDisclosureDto })
  externalBounds!: BoundDisclosureDto;

  @ApiProperty({ type: [ModuleFileDto] })
  files!: ModuleFileDto[];

  @ApiProperty({ type: BoundDisclosureDto })
  fileBounds!: BoundDisclosureDto;

  @ApiProperty({ type: [ModuleSymbolDto] })
  notableSymbols!: ModuleSymbolDto[];

  @ApiProperty({ type: [String] })
  limitations!: string[];
}

export class DependencyEvidenceItemDto {
  @ApiProperty({ type: ArchitectureSourceReferenceDto })
  source!: ArchitectureSourceReferenceDto;

  @ApiProperty({ type: ArchitectureSourceReferenceDto })
  target!: ArchitectureSourceReferenceDto;

  @ApiPropertyOptional({
    description: 'The import specifier exactly as written in source.',
  })
  observedTarget?: string | null;

  @ApiPropertyOptional()
  targetName?: string | null;

  @ApiProperty({
    enum: ['RELATIVE_PATH', 'PATH_SUFFIX', 'PYTHON_MODULE_PATH'],
    description: 'How the observed target was attributed to a file.',
  })
  resolutionStrategy!: ResolutionStrategy;
}

export class DependencyEvidenceResponseDto {
  @ApiProperty()
  repositoryId!: string;

  @ApiProperty({ type: ArchitectureRevisionDto })
  revision!: ArchitectureRevisionDto;

  @ApiProperty()
  fromModuleKey!: string;

  @ApiProperty()
  toModuleKey!: string;

  @ApiProperty({ enum: SymbolRelationType, isArray: true })
  relationTypes!: SymbolRelationType[];

  @ApiProperty()
  supportingRelationCount!: number;

  @ApiProperty({ enum: ['RESOLVED', 'UNRESOLVED', 'EXTERNAL'] })
  confidence!: DependencyConfidence;

  @ApiProperty({ type: [DependencyEvidenceItemDto] })
  items!: DependencyEvidenceItemDto[];

  @ApiProperty({ type: BoundDisclosureDto })
  bounds!: BoundDisclosureDto;

  @ApiProperty({ type: [String] })
  limitations!: string[];
}
