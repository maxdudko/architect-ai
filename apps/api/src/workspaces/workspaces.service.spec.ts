import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MembershipStatus, Workspace, WorkspaceRole } from '@prisma/client';
import { MembershipsRepository } from '../memberships/memberships.repository';
import { WorkspacesRepository } from './workspaces.repository';
import { WorkspacesService } from './workspaces.service';

const FREE_PLAN_ID = 'plan-free';

describe('WorkspacesService', () => {
  const userId = 'user-1';
  const workspaceId = 'workspace-1';

  const workspace: Workspace = {
    id: workspaceId,
    name: 'Team Workspace',
    slug: 'team-workspace',
    planId: FREE_PLAN_ID,
    createdAt: new Date('2026-06-24T00:00:00.000Z'),
    updatedAt: new Date('2026-06-24T00:00:00.000Z'),
    deletedAt: null,
  };

  const membership = {
    id: 'membership-1',
    workspaceId,
    userId,
    role: WorkspaceRole.OWNER,
    status: MembershipStatus.ACTIVE,
    joinedAt: new Date('2026-06-24T00:00:00.000Z'),
    lastSeenAt: null,
    createdAt: new Date('2026-06-24T00:00:00.000Z'),
    updatedAt: new Date('2026-06-24T00:00:00.000Z'),
    deletedAt: null,
  };

  let workspacesRepository: jest.Mocked<WorkspacesRepository>;
  let membershipsRepository: jest.Mocked<MembershipsRepository>;
  let service: WorkspacesService;

  beforeEach(() => {
    workspacesRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findBySlug: jest.fn(),
      update: jest.fn(),
      listForUser: jest.fn(),
    } as unknown as jest.Mocked<WorkspacesRepository>;

    membershipsRepository = {
      create: jest.fn(),
      findByWorkspaceAndUser: jest.fn(),
    } as unknown as jest.Mocked<MembershipsRepository>;

    service = new WorkspacesService(
      workspacesRepository,
      membershipsRepository,
      {
        getWorkspaceUsage: jest.fn(),
      } as never,
      {
        plan: {
          findUniqueOrThrow: jest.fn().mockResolvedValue({ id: FREE_PLAN_ID }),
        },
      } as never,
    );
  });

  it('creates a personal workspace with owner membership', async () => {
    workspacesRepository.findBySlug.mockResolvedValue(null);
    workspacesRepository.create.mockResolvedValue(workspace);
    membershipsRepository.create.mockResolvedValue(membership);

    const result = await service.createPersonalWorkspace(userId, 'Ada');

    expect(workspacesRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Ada's Workspace",
        planId: FREE_PLAN_ID,
      }),
    );
    expect(membershipsRepository.create).toHaveBeenCalledWith({
      workspaceId: workspace.id,
      userId,
      role: WorkspaceRole.OWNER,
      status: MembershipStatus.ACTIVE,
    });
    expect(result.id).toBe(workspaceId);
  });

  it('returns workspace access for active members', async () => {
    workspacesRepository.findById.mockResolvedValue(workspace);
    membershipsRepository.findByWorkspaceAndUser.mockResolvedValue(membership);

    const result = await service.getWorkspaceForUser(workspaceId, userId);

    expect(result.workspace.id).toBe(workspaceId);
    expect(result.role).toBe(WorkspaceRole.OWNER);
  });

  it('rejects access when workspace is deleted', async () => {
    workspacesRepository.findById.mockResolvedValue({
      ...workspace,
      deletedAt: new Date(),
    });

    await expect(
      service.getWorkspaceForUser(workspaceId, userId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects access without active membership', async () => {
    workspacesRepository.findById.mockResolvedValue(workspace);
    membershipsRepository.findByWorkspaceAndUser.mockResolvedValue({
      ...membership,
      status: MembershipStatus.REMOVED,
    });

    await expect(
      service.getWorkspaceForUser(workspaceId, userId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows owners to update workspace settings', async () => {
    workspacesRepository.findById.mockResolvedValue(workspace);
    membershipsRepository.findByWorkspaceAndUser.mockResolvedValue(membership);
    workspacesRepository.findBySlug.mockResolvedValue(null);
    workspacesRepository.update.mockResolvedValue({
      ...workspace,
      name: 'Renamed Workspace',
      slug: 'renamed-workspace',
    });

    const result = await service.updateWorkspace(workspaceId, userId, {
      name: 'Renamed Workspace',
    });

    expect(result.name).toBe('Renamed Workspace');
    expect(workspacesRepository.update).toHaveBeenCalledWith(
      workspaceId,
      expect.objectContaining({
        name: 'Renamed Workspace',
        slug: 'renamed-workspace',
      }),
    );
  });

  it('rejects workspace updates from members', async () => {
    workspacesRepository.findById.mockResolvedValue(workspace);
    membershipsRepository.findByWorkspaceAndUser.mockResolvedValue({
      ...membership,
      role: WorkspaceRole.MEMBER,
    });

    await expect(
      service.updateWorkspace(workspaceId, userId, { name: 'Forbidden' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('generates unique slugs when names collide', async () => {
    workspacesRepository.findBySlug
      .mockResolvedValueOnce(workspace)
      .mockResolvedValueOnce(null);
    workspacesRepository.create.mockResolvedValue({
      ...workspace,
      slug: 'team-workspace-1',
    });
    membershipsRepository.create.mockResolvedValue(membership);

    await service.createWorkspaceForUser(userId, { name: 'Team Workspace' });

    expect(workspacesRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'team-workspace-1',
      }),
    );
  });

  it('fails slug generation after too many collisions', async () => {
    workspacesRepository.findBySlug.mockResolvedValue(workspace);

    await expect(
      service.createWorkspaceForUser(userId, { name: 'Team Workspace' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
