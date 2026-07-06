export const REPOSITORY_INDEXING_QUEUE = 'repository-indexing';

export const INDEXING_JOB_NAMES = {
  reindex: 'reindex',
  clone: 'clone',
  parse: 'parse',
  chunk: 'chunk',
  embed: 'embed',
} as const;

export type IndexingJobName =
  (typeof INDEXING_JOB_NAMES)[keyof typeof INDEXING_JOB_NAMES];

export type IndexingTrigger =
  | 'INITIAL_CONNECT'
  | 'MANUAL_RETRY'
  | 'MANUAL_REINDEX';

export interface ReindexJobData {
  workspaceId: string;
  repositoryId: string;
  userId: string;
  branch?: string;
  trigger: IndexingTrigger;
}

export interface CloneJobData extends ReindexJobData {
  runId: string;
}

export interface ParseJobData extends CloneJobData {
  clonePath: string;
}

export type ChunkJobData = ParseJobData;

export type EmbedJobData = ChunkJobData;
