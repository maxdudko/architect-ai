import { GuideType, Prisma } from '@prisma/client';
import type { RetrievedChunkReference } from '../../retrieval/types/retrieved-context.type';
import type { RepositoryTopology, TopologyCandidate } from './topology.type';

export interface PriorGuideSummary {
  type: GuideType;
  slug: string;
  title: string;
  summary: string;
}

export interface GuideGenerationContext {
  workspaceId: string;
  repositoryId: string;
  topology: RepositoryTopology;
  priorGuides?: PriorGuideSummary[];
}

export interface GuideGenerationTarget {
  type: GuideType;
  key: string;
  slug: string;
  title: string;
  candidate?: TopologyCandidate;
}

export interface GuideGenerationResult {
  type: GuideType;
  slug: string;
  title: string;
  markdown: string;
  summary: string;
  metadata: Prisma.InputJsonValue;
  citations: RetrievedChunkReference[];
  model: string;
}
