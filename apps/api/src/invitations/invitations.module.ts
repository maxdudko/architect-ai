import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../common/guards/roles.guard';
import { WorkspaceParamGuard } from '../common/guards/workspace-param.guard';
import { MailModule } from '../mail/mail.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { UsageModule } from '../usage/usage.module';
import { UsersModule } from '../users/users.module';
import { InvitationsController } from './invitations.controller';
import { InvitationsRepository } from './invitations.repository';
import { InvitationsService } from './invitations.service';

@Module({
  imports: [
    MembershipsModule,
    UsersModule,
    AuthModule,
    MailModule,
    UsageModule,
  ],
  controllers: [InvitationsController],
  providers: [
    InvitationsRepository,
    InvitationsService,
    WorkspaceParamGuard,
    RolesGuard,
  ],
  exports: [InvitationsService],
})
export class InvitationsModule {}
