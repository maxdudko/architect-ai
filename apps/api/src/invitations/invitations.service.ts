import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  Invitation,
  InvitationStatus,
  UsageMetric,
  WorkspaceRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth/auth.service';
import { AuthResponse } from '../auth/interfaces/auth-response.interface';
import { MailService } from '../mail/mail.service';
import { MembershipsService } from '../memberships/memberships.service';
import { UsageService } from '../usage/usage.service';
import { UsersService } from '../users/users.service';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import {
  InvitationDeliveryDto,
  InvitationListItemDto,
} from './dto/invitation-list-item.dto';
import { InvitationPreviewDto } from './dto/invitation-preview.dto';
import { InvitationsRepository } from './invitations.repository';

const INVITATION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    private readonly invitationsRepository: InvitationsRepository,
    private readonly membershipsService: MembershipsService,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly mailService: MailService,
    private readonly usageService: UsageService,
  ) {}

  async listInvitations(
    workspaceId: string,
    actorUserId: string,
  ): Promise<InvitationListItemDto[]> {
    await this.assertCanManageInvitations(workspaceId, actorUserId);

    const invitations =
      await this.invitationsRepository.listPendingByWorkspace(workspaceId);

    return invitations.map((invitation) => this.toListItem(invitation));
  }

  async resendInvitation(
    workspaceId: string,
    actorUserId: string,
    invitationId: string,
  ): Promise<InvitationDeliveryDto> {
    await this.assertCanManageInvitations(workspaceId, actorUserId);

    const invitation =
      await this.invitationsRepository.findPendingByIdAndWorkspace(
        invitationId,
        workspaceId,
      );
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    const updatedInvitation = await this.invitationsRepository.updateExpiresAt(
      invitation.id,
      expiresAt,
    );

    const delivery = await this.deliverInvitationEmail(updatedInvitation.token);

    return {
      ...this.toListItem(updatedInvitation),
      emailSent: delivery.emailSent,
    };
  }

  async createInvitation(
    workspaceId: string,
    actorUserId: string,
    email: string,
    role: WorkspaceRole,
  ): Promise<InvitationDeliveryDto> {
    const normalizedEmail = email.toLowerCase();

    await this.assertCanManageInvitations(workspaceId, actorUserId);

    const existing =
      await this.invitationsRepository.findPendingByWorkspaceAndEmail(
        workspaceId,
        normalizedEmail,
      );

    if (existing) {
      if (existing.expiresAt > new Date()) {
        throw new ForbiddenException(
          'An active invitation already exists for this email',
        );
      }

      await this.invitationsRepository.markExpired(existing.id);
    }

    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    const invitation = await this.invitationsRepository.create({
      workspaceId,
      email: normalizedEmail,
      role,
      token: randomUUID(),
      status: InvitationStatus.PENDING,
      expiresAt,
    });

    const delivery = await this.deliverInvitationEmail(invitation.token);

    return {
      ...this.toListItem(invitation),
      emailSent: delivery.emailSent,
    };
  }

  async getInvitationPreview(token: string): Promise<InvitationPreviewDto> {
    const invitation =
      await this.invitationsRepository.findPendingByTokenWithWorkspace(token);
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.expiresAt <= new Date()) {
      await this.invitationsRepository.markExpired(invitation.id);
      throw new GoneException('Invitation has expired');
    }

    const existingUser = await this.usersService.findByEmail(invitation.email);

    return {
      email: invitation.email,
      role: invitation.role,
      workspaceName: invitation.workspace.name,
      expiresAt: invitation.expiresAt.toISOString(),
      requiresSignUp: !existingUser,
    };
  }

  async acceptInvitation(
    token: string,
    dto: AcceptInvitationDto,
  ): Promise<AuthResponse> {
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

    const existingMembership = await this.membershipsService
      .resolveActiveMembership(invitation.workspaceId, user.id)
      .catch(() => null);
    if (!existingMembership) {
      await this.usageService.assertWithinLimit(
        invitation.workspaceId,
        UsageMetric.MEMBERS,
      );
    }

    await this.membershipsService.addOrActivateMember(
      invitation.workspaceId,
      user.id,
      invitation.role,
    );
    await this.invitationsRepository.markAccepted(invitation.id);

    return this.authService.createSessionForUser(
      user.id,
      invitation.workspaceId,
    );
  }

  private async assertCanManageInvitations(
    workspaceId: string,
    actorUserId: string,
  ): Promise<void> {
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
        'Only workspace owners or admins can manage invitations',
      );
    }
  }

  private toListItem(invitation: Invitation): InvitationListItemDto {
    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
      inviteUrl: this.mailService.buildInviteUrl(invitation.token),
    };
  }

  private async deliverInvitationEmail(
    token: string,
  ): Promise<{ inviteUrl: string; emailSent: boolean }> {
    const invitation =
      await this.invitationsRepository.findPendingByTokenWithWorkspace(token);
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    const inviteUrl = this.mailService.buildInviteUrl(invitation.token);
    try {
      await this.mailService.sendWorkspaceInvitation({
        to: invitation.email,
        workspaceName: invitation.workspace.name,
        role: invitation.role,
        inviteUrl,
        expiresAt: invitation.expiresAt,
      });
      return { inviteUrl, emailSent: true };
    } catch (error) {
      this.logger.error(
        `Failed to send invitation email to ${invitation.email}; invitation ${invitation.id} was kept`,
        error instanceof Error ? error.stack : undefined,
      );
      return { inviteUrl, emailSent: false };
    }
  }
}
