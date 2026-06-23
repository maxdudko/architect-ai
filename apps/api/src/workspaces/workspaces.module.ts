import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesRepository } from './workspaces.repository';
import { WorkspacesService } from './workspaces.service';

@Module({
  imports: [ConfigModule, MembershipsModule, forwardRef(() => AuthModule)],
  controllers: [WorkspacesController],
  providers: [WorkspacesRepository, WorkspacesService],
  exports: [WorkspacesService, WorkspacesRepository],
})
export class WorkspacesModule {}
