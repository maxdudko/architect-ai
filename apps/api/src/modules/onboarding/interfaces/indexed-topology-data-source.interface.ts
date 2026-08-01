import type { IndexedTopologySnapshot } from '../types/topology.type';

export interface IndexedTopologyDataSource {
  loadLatest(
    workspaceId: string,
    repositoryId: string,
  ): Promise<IndexedTopologySnapshot>;
}
