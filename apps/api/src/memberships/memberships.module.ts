import { Module } from '@nestjs/common';
import { RolesGuard } from '../common/guards/roles.guard';
import { WorkspaceParamGuard } from '../common/guards/workspace-param.guard';
import { MembershipsController } from './memberships.controller';
import { MembershipsRepository } from './memberships.repository';
import { MembershipsService } from './memberships.service';

@Module({
  providers: [
    MembershipsRepository,
    MembershipsService,
    RolesGuard,
    WorkspaceParamGuard,
  ],
  controllers: [MembershipsController],
  exports: [MembershipsService, MembershipsRepository],
})
export class MembershipsModule {}
