import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InvitationStatus, WorkspaceRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { MembershipsService } from '../memberships/memberships.service';
import { UsersService } from '../users/users.service';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { InvitationsRepository } from './invitations.repository';

@Injectable()
export class InvitationsService {
  constructor(
    private readonly invitationsRepository: InvitationsRepository,
    private readonly membershipsService: MembershipsService,
    private readonly usersService: UsersService,
  ) {}

  async createInvitation(
    workspaceId: string,
    actorUserId: string,
    email: string,
    role: WorkspaceRole,
  ): Promise<{
    id: string;
    email: string;
    role: WorkspaceRole;
    token: string;
    expiresAt: Date;
  }> {
    const actorMembership =
      await this.membershipsService.resolveActiveMembership(
        workspaceId,
        actorUserId,
      );
    if (
      !(
        actorMembership.role === WorkspaceRole.OWNER ||
        actorMembership.role === WorkspaceRole.ADMIN
      )
    ) {
      throw new ForbiddenException(
        'Only workspace owners or admins can create invitations',
      );
    }

    const existing =
      await this.invitationsRepository.findPendingByWorkspaceAndEmail(
        workspaceId,
        email,
      );

    if (existing) {
      if (existing.expiresAt > new Date()) {
        throw new ForbiddenException(
          'An active invitation already exists for this email',
        );
      }

      await this.invitationsRepository.markExpired(existing.id);
    }

    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    const invitation = await this.invitationsRepository.create({
      workspaceId,
      email,
      role,
      token: randomUUID(),
      status: InvitationStatus.PENDING,
      expiresAt,
    });

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      token: invitation.token,
      expiresAt: invitation.expiresAt,
    };
  }

  async acceptInvitation(
    token: string,
    dto: AcceptInvitationDto,
  ): Promise<{
    workspaceId: string;
    userId: string;
  }> {
    const invitation =
      await this.invitationsRepository.findPendingByToken(token);
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.expiresAt <= new Date()) {
      await this.invitationsRepository.markExpired(invitation.id);
      throw new BadRequestException('Invitation has expired');
    }
    if (
      dto.email &&
      dto.email.toLowerCase() !== invitation.email.toLowerCase()
    ) {
      throw new BadRequestException('Invitation email does not match');
    }

    let user = await this.usersService.findByEmail(invitation.email);
    if (!user) {
      if (!dto.password || !dto.firstName || !dto.lastName) {
        throw new BadRequestException(
          'firstName, lastName, and password are required for new accounts',
        );
      }

      const passwordHash = await bcrypt.hash(dto.password, 12);
      user = await this.usersService.create({
        email: invitation.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        emailVerified: true,
      });
    }

    await this.membershipsService.addOrActivateMember(
      invitation.workspaceId,
      user.id,
      invitation.role,
    );
    await this.invitationsRepository.markAccepted(invitation.id);

    return { workspaceId: invitation.workspaceId, userId: user.id };
  }
}
