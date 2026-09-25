import type { SymbolRelationType } from '@prisma/client';
import { ARCHITECTURE_SEARCH_LIMITS } from './architecture-search.constants';
import type { StructuralIntent } from './architecture-search.constants';
import type { DependencyGraph } from '../dependency-mapping/types/dependency-graph.type';

export interface BoundDisclosure {
  limit: number;
  returned: number;
  total: number;
  truncated: boolean;
}

export interface StructuralEvidenceRef {
  repositoryId: string;
  filePath: string;
  startLine: null;
  endLine: null;
  name: string | null;
  qualifiedName: string | null;
  relationType: SymbolRelationType;
}

export interface StructuralFinding {
  direction: 'DEPENDENCY' | 'DEPENDENT';
  moduleKey: string;
  moduleName: string;
  relatedModuleKey: string;
  relatedModuleName: string;
  relationTypes: SymbolRelationType[];
  supportingRelationCount: number;
  confidence: 'RESOLVED';
  epistemic: 'OBSERVED';
  evidence: StructuralEvidenceRef[];
}

export interface StructuralNeighborhood {
  findings: StructuralFinding[];
  dependencyBounds: BoundDisclosure;
  dependentBounds: BoundDisclosure;
}

/**
 * Reads one module's direct neighborhood from an already derived graph.
 * Ordering follows supporting relationship count, then module key.
 */
export function queryModuleNeighborhood(
  graph: DependencyGraph,
  repositoryId: string,
  moduleKey: string,
  intent: StructuralIntent,
): StructuralNeighborhood {
  const names = new Map(
    graph.modules.map((module) => [module.key, module.name]),
  );
  const subjectName = names.get(moduleKey) ?? moduleKey;

  const includeDependencies =
    intent === 'DEPENDENCIES_OF' || intent === 'CONNECTED_TO';
  const includeDependents =
    intent === 'DEPENDENTS_OF' ||
    intent === 'CONNECTED_TO' ||
    intent === 'MODULE_REFERENCES';

  const dependencies = includeDependencies
    ? graph.dependencies.filter((edge) => edge.fromModuleKey === moduleKey)
    : [];
  const dependents = includeDependents
    ? graph.dependencies.filter((edge) => edge.toModuleKey === moduleKey)
    : [];

  const dependencyPage = dependencies.slice(
    0,
    ARCHITECTURE_SEARCH_LIMITS.dependenciesPerFinding,
  );
  const dependentPage = dependents.slice(
    0,
    ARCHITECTURE_SEARCH_LIMITS.dependentsPerFinding,
  );

  const findings = [
    ...dependencyPage.map((edge) =>
      toFinding({
        direction: 'DEPENDENCY' as const,
        moduleKey,
        moduleName: subjectName,
        relatedModuleKey: edge.toModuleKey,
        relatedModuleName: names.get(edge.toModuleKey) ?? edge.toModuleKey,
        relationTypes: edge.relationTypes,
        supportingRelationCount: edge.supportingRelationCount,
        evidence: edge.evidence.map((item) => ({
          repositoryId,
          filePath: item.sourceFilePath,
          startLine: null,
          endLine: null,
          name: item.targetName,
          qualifiedName: item.observedTarget ?? item.targetFilePath,
          relationType: item.relationType,
        })),
      }),
    ),
    ...dependentPage.map((edge) =>
      toFinding({
        direction: 'DEPENDENT' as const,
        moduleKey,
        moduleName: subjectName,
        relatedModuleKey: edge.fromModuleKey,
        relatedModuleName: names.get(edge.fromModuleKey) ?? edge.fromModuleKey,
        relationTypes: edge.relationTypes,
        supportingRelationCount: edge.supportingRelationCount,
        evidence: edge.evidence.map((item) => ({
          repositoryId,
          filePath: item.sourceFilePath,
          startLine: null,
          endLine: null,
          name: item.targetName,
          qualifiedName: item.observedTarget ?? item.targetFilePath,
          relationType: item.relationType,
        })),
      }),
    ),
  ];

  return {
    findings,
    dependencyBounds: disclose(
      ARCHITECTURE_SEARCH_LIMITS.dependenciesPerFinding,
      dependencyPage.length,
      dependencies.length,
    ),
    dependentBounds: disclose(
      ARCHITECTURE_SEARCH_LIMITS.dependentsPerFinding,
      dependentPage.length,
      dependents.length,
    ),
  };
}

function toFinding(
  finding: Omit<StructuralFinding, 'confidence' | 'epistemic' | 'evidence'> & {
    evidence: StructuralEvidenceRef[];
  },
): StructuralFinding {
  return {
    ...finding,
    confidence: 'RESOLVED',
    epistemic: 'OBSERVED',
    evidence: finding.evidence.slice(
      0,
      ARCHITECTURE_SEARCH_LIMITS.evidencePerFinding,
    ),
  };
}

export function disclose(
  limit: number,
  returned: number,
  total: number,
): BoundDisclosure {
  return { limit, returned, total, truncated: returned < total };
}

export function emptyNeighborhood(): StructuralNeighborhood {
  return {
    findings: [],
    dependencyBounds: disclose(
      ARCHITECTURE_SEARCH_LIMITS.dependenciesPerFinding,
      0,
      0,
    ),
    dependentBounds: disclose(
      ARCHITECTURE_SEARCH_LIMITS.dependentsPerFinding,
      0,
      0,
    ),
  };
}
