import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MembershipStatus, WorkspaceRole } from '@prisma/client';
import { MembershipsRepository } from './memberships.repository';

@Injectable()
export class MembershipsService {
  constructor(private readonly membershipsRepository: MembershipsRepository) {}

  async resolveActiveMembership(
    workspaceId: string,
    userId: string,
  ): Promise<{
    membershipId: string;
    role: WorkspaceRole;
  }> {
    const membership = await this.membershipsRepository.findByWorkspaceAndUser(
      workspaceId,
      userId,
    );

    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException(
        'No active membership found for this workspace',
      );
    }

    return { membershipId: membership.id, role: membership.role };
  }

  async listMembers(
    workspaceId: string,
    currentUserId: string,
  ): Promise<
    Array<{
      id: string;
      role: WorkspaceRole;
      status: MembershipStatus;
      joinedAt: Date;
      lastSeenAt: Date | null;
      user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        avatarUrl: string | null;
      };
    }>
  > {
    await this.resolveActiveMembership(workspaceId, currentUserId);
    return this.membershipsRepository.listWorkspaceMembers(workspaceId);
  }

  async addOrActivateMember(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): Promise<void> {
    await this.membershipsRepository.setRoleAndStatus(
      workspaceId,
      userId,
      role,
      MembershipStatus.ACTIVE,
    );
  }

  async updateMemberRole(
    workspaceId: string,
    membershipId: string,
    actorUserId: string,
    role: WorkspaceRole,
  ): Promise<{
    id: string;
    role: WorkspaceRole;
    status: MembershipStatus;
    joinedAt: Date;
    lastSeenAt: Date | null;
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      avatarUrl: string | null;
    };
  }> {
    const actor = await this.membershipsRepository.findByWorkspaceAndUser(
      workspaceId,
      actorUserId,
    );
    if (!actor || actor.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException(
        'Only active workspace members can manage members',
      );
    }
    if (
      !(
        actor.role === WorkspaceRole.OWNER || actor.role === WorkspaceRole.ADMIN
      )
    ) {
      throw new ForbiddenException(
        'Only owners or admins can update member roles',
      );
    }

    const membership = await this.membershipsRepository.findById(
      workspaceId,
      membershipId,
    );
    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new NotFoundException('Member not found in this workspace');
    }
    if (membership.userId === actorUserId) {
      throw new ForbiddenException('You cannot change your own role');
    }
    if (membership.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException('Owner role cannot be changed');
    }

    if (actor.role === WorkspaceRole.ADMIN) {
      if (
        membership.role === WorkspaceRole.ADMIN ||
        role === WorkspaceRole.OWNER ||
        role === WorkspaceRole.ADMIN
      ) {
        throw new ForbiddenException(
          'Admins can only assign member or viewer roles',
        );
      }
    }

    const updatedCount = await this.membershipsRepository.updateRole(
      workspaceId,
      membershipId,
      role,
    );
    if (updatedCount === 0) {
      throw new NotFoundException('Member not found in this workspace');
    }

    const members =
      await this.membershipsRepository.listWorkspaceMembers(workspaceId);
    const updated = members.find((member) => member.id === membershipId);
    if (!updated) {
      throw new NotFoundException('Member not found in this workspace');
    }

    return updated;
  }

  async removeMember(
    workspaceId: string,
    membershipId: string,
    actorUserId: string,
  ): Promise<void> {
    const actor = await this.membershipsRepository.findByWorkspaceAndUser(
      workspaceId,
      actorUserId,
    );
    if (!actor || actor.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException(
        'Only active workspace members can manage members',
      );
    }
    if (
      !(
        actor.role === WorkspaceRole.OWNER || actor.role === WorkspaceRole.ADMIN
      )
    ) {
      throw new ForbiddenException('Only owners or admins can remove members');
    }

    const members =
      await this.membershipsRepository.listWorkspaceMembers(workspaceId);
    const target = members.find((member) => member.id === membershipId);

    if (!target) {
      throw new NotFoundException('Member not found in this workspace');
    }
    if (target.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException('Owner membership cannot be removed');
    }

    const removedCount = await this.membershipsRepository.removeMember(
      workspaceId,
      membershipId,
    );
    if (removedCount === 0) {
      throw new NotFoundException('Member not found in this workspace');
    }
  }
}
