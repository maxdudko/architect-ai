import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaArchitectureDataSource } from './data/prisma-architecture-data-source';
import {
  DEPENDENCY_MAP_CACHE,
  type DependencyMapCache,
} from './cache/dependency-map-cache.interface';
import {
  DEPENDENCY_MAP_CACHE_TTL_SECONDS,
  DEPENDENCY_MAP_CACHE_VERSION,
} from './dependency-map.constants';
import { DependencyGraphBuilder } from './derivation/dependency-graph.builder';
import type { DependencyGraph } from './types/dependency-graph.type';

/**
 * Serves the derived graph for one revision, deriving it at most once.
 *
 * The cache key is the indexing revision, so a new successful run produces a
 * new key and a view can never straddle two revisions (spec IR-3). The
 * in-flight map collapses concurrent requests for the same revision into a
 * single derivation, so several members opening the surface together do not
 * each pay the cost (spec LG-6).
 */
@Injectable()
export class DependencyGraphProvider {
  private readonly logger = new Logger(DependencyGraphProvider.name);
  private readonly inFlight = new Map<string, Promise<DependencyGraph>>();

  constructor(
    private readonly dataSource: PrismaArchitectureDataSource,
    private readonly builder: DependencyGraphBuilder,
    @Inject(DEPENDENCY_MAP_CACHE)
    private readonly cache: DependencyMapCache,
  ) {}

  async getGraph(
    repositoryId: string,
    indexingRunId: string,
  ): Promise<DependencyGraph> {
    const key = cacheKey(repositoryId, indexingRunId);

    const cached = await this.cache.get<DependencyGraph>(key);
    if (cached) {
      return cached;
    }

    const pending = this.inFlight.get(key);
    if (pending) {
      return pending;
    }

    const derivation = this.derive(repositoryId, indexingRunId, key).finally(
      () => {
        this.inFlight.delete(key);
      },
    );
    this.inFlight.set(key, derivation);

    return derivation;
  }

  private async derive(
    repositoryId: string,
    indexingRunId: string,
    key: string,
  ): Promise<DependencyGraph> {
    const startedAt = Date.now();
    const snapshot = await this.dataSource.loadSnapshot(
      repositoryId,
      indexingRunId,
    );
    const graph = this.builder.build(snapshot);

    this.logger.log(
      JSON.stringify({
        event: 'architecture_dependency_graph_derived',
        repositoryId,
        indexingRunId,
        moduleCount: graph.totals.moduleCount,
        dependencyCount: graph.totals.dependencyCount,
        partial: graph.partial,
        durationMs: Date.now() - startedAt,
        service: 'architecture',
      }),
    );

    await this.cache.set(key, graph, DEPENDENCY_MAP_CACHE_TTL_SECONDS);

    return graph;
  }
}

function cacheKey(repositoryId: string, indexingRunId: string): string {
  return `depmap:${DEPENDENCY_MAP_CACHE_VERSION}:${repositoryId}:${indexingRunId}`;
}
