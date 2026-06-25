import { Module } from '@nestjs/common';
import { RolesGuard } from '../common/guards/roles.guard';
import { WorkspaceParamGuard } from '../common/guards/workspace-param.guard';
import { MembershipsModule } from '../memberships/memberships.module';
import { RepositoriesController } from './repositories.controller';
import { RepositoriesRepository } from './repositories.repository';
import { RepositoriesService } from './repositories.service';

@Module({
  imports: [MembershipsModule],
  controllers: [RepositoriesController],
  providers: [
    RepositoriesRepository,
    RepositoriesService,
    WorkspaceParamGuard,
    RolesGuard,
  ],
  exports: [RepositoriesService, RepositoriesRepository],
})
export class RepositoriesModule {}
