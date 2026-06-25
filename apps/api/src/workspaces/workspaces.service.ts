import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MembershipStatus,
  Workspace,
  WorkspacePlan,
  WorkspaceRole,
} from '@prisma/client';
import { MembershipsRepository } from '../memberships/memberships.repository';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspacesRepository } from './workspaces.repository';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly workspacesRepository: WorkspacesRepository,
    private readonly membershipsRepository: MembershipsRepository,
  ) {}

  async createPersonalWorkspace(
    userId: string,
    firstName: string,
  ): Promise<Workspace> {
    const workspaceName = `${firstName}'s Workspace`;
    return this.createWorkspaceForUser(
      userId,
      {
        name: workspaceName,
        plan: WorkspacePlan.FREE,
      },
      WorkspaceRole.OWNER,
    );
  }

  async createWorkspaceForUser(
    userId: string,
    dto: CreateWorkspaceDto,
    role: WorkspaceRole = WorkspaceRole.OWNER,
  ): Promise<Workspace> {
    const slug = await this.generateUniqueSlug(dto.name);
    const workspace = await this.workspacesRepository.create({
      name: dto.name,
      slug,
      plan: dto.plan ?? WorkspacePlan.FREE,
    });

    await this.membershipsRepository.create({
      workspaceId: workspace.id,
      userId,
      role,
      status: MembershipStatus.ACTIVE,
    });

    return workspace;
  }

  async listForUser(userId: string): Promise<
    Array<{
      id: string;
      name: string;
      slug: string;
      role: WorkspaceRole;
    }>
  > {
    return this.workspacesRepository.listForUser(userId);
  }

  async getWorkspaceForUser(
    workspaceId: string,
    userId: string,
  ): Promise<{ workspace: Workspace; role: WorkspaceRole }> {
    const workspace = await this.workspacesRepository.findById(workspaceId);
    if (!workspace || workspace.deletedAt) {
      throw new NotFoundException('Workspace not found');
    }

    const membership = await this.membershipsRepository.findByWorkspaceAndUser(
      workspaceId,
      userId,
    );
    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException('No active membership in this workspace');
    }

    return { workspace, role: membership.role };
  }

  async updateWorkspace(
    workspaceId: string,
    userId: string,
    dto: UpdateWorkspaceDto,
  ): Promise<Workspace> {
    const { role } = await this.getWorkspaceForUser(workspaceId, userId);
    if (!(role === WorkspaceRole.OWNER || role === WorkspaceRole.ADMIN)) {
      throw new ForbiddenException(
        'Only workspace owners and admins can update workspace settings',
      );
    }

    const data: { name?: string; slug?: string; plan?: WorkspacePlan } = {};

    if (dto.name) {
      data.name = dto.name;
      data.slug = await this.generateUniqueSlug(dto.name, workspaceId);
    }
    if (dto.plan) {
      data.plan = dto.plan;
    }

    return this.workspacesRepository.update(workspaceId, data);
  }

  private async generateUniqueSlug(
    rawName: string,
    currentWorkspaceId?: string,
  ): Promise<string> {
    const baseSlug = rawName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);

    let candidate = baseSlug || 'workspace';
    const normalizedBase = baseSlug || 'workspace';
    let suffix = 1;

    while (true) {
      const existing = await this.workspacesRepository.findBySlug(candidate);
      if (!existing || existing.id === currentWorkspaceId) {
        return candidate;
      }

      if (suffix > 1000) {
        throw new ConflictException('Unable to generate unique workspace slug');
      }
      candidate = `${normalizedBase}-${suffix}`;
      suffix += 1;
    }
  }
}
