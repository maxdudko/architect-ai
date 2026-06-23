import { Module } from '@nestjs/common';
import { MembershipsModule } from '../memberships/memberships.module';
import { UsersModule } from '../users/users.module';
import { InvitationsController } from './invitations.controller';
import { InvitationsRepository } from './invitations.repository';
import { InvitationsService } from './invitations.service';

@Module({
  imports: [MembershipsModule, UsersModule],
  controllers: [InvitationsController],
  providers: [InvitationsRepository, InvitationsService],
  exports: [InvitationsService],
})
export class InvitationsModule {}
