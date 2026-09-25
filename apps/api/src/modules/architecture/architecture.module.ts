import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MembershipsModule } from '../../memberships/memberships.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WorkspaceParamGuard } from '../../common/guards/workspace-param.guard';
import { InMemoryDependencyMapCache } from './dependency-mapping/cache/in-memory-dependency-map.cache';
import { RedisDependencyMapCache } from './dependency-mapping/cache/redis-dependency-map.cache';
import { DEPENDENCY_MAP_CACHE } from './dependency-mapping/cache/dependency-map-cache.interface';
import { PrismaArchitectureDataSource } from './dependency-mapping/data/prisma-architecture-data-source';
import { DependencyMapController } from './dependency-mapping/dependency-map.controller';
import { DependencyMapService } from './dependency-mapping/dependency-map.service';
import { DependencyGraphProvider } from './dependency-mapping/dependency-graph.provider';
import { DependencyGraphBuilder } from './dependency-mapping/derivation/dependency-graph.builder';
import { ModuleGrouperService } from './dependency-mapping/derivation/module-grouper.service';
import { TargetResolverService } from './dependency-mapping/derivation/target-resolver.service';

/**
 * Phase 2 Architecture Explorer.
 *
 * Dependency Mapping owns the module grouping and the dependency edges, so
 * `DependencyGraphProvider` and `DependencyMapService` are exported for
 * Architecture Search and System Overview to consume rather than re-deriving.
 */
@Module({
  imports: [ConfigModule, PrismaModule, MembershipsModule],
  controllers: [DependencyMapController],
  providers: [
    PrismaArchitectureDataSource,
    ModuleGrouperService,
    TargetResolverService,
    DependencyGraphBuilder,
    {
      provide: DEPENDENCY_MAP_CACHE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const driver =
          configService.get<string>('ARCHITECTURE_CACHE_DRIVER') ?? 'redis';
        return driver === 'memory'
          ? new InMemoryDependencyMapCache()
          : new RedisDependencyMapCache(configService);
      },
    },
    DependencyGraphProvider,
    DependencyMapService,
    WorkspaceParamGuard,
    RolesGuard,
  ],
  exports: [DependencyGraphProvider, DependencyMapService],
})
export class ArchitectureModule {}
