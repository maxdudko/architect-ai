import { GUARDS_METADATA, HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { WorkspaceRole } from '@prisma/client';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WorkspaceParamGuard } from '../../common/guards/workspace-param.guard';
import { OnboardingGuidesController } from './onboarding-guides.controller';
import { OnboardingGuidesService } from './onboarding-guides.service';

describe('OnboardingGuidesController', () => {
  let service: jest.Mocked<OnboardingGuidesService>;
  let controller: OnboardingGuidesController;

  beforeEach(() => {
    service = {
      listGuides: jest.fn().mockResolvedValue({ guides: [], total: 0 }),
      getGuide: jest.fn(),
      getLatestGenerationRun: jest.fn().mockResolvedValue(null),
      generateGuides: jest.fn().mockResolvedValue({}),
      regenerateGuides: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<OnboardingGuidesService>;
    controller = new OnboardingGuidesController(service);
  });

  it('protects every route with JWT, workspace membership, and role guards', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      OnboardingGuidesController,
    );

    expect(guards).toEqual([JwtAuthGuard, WorkspaceParamGuard, RolesGuard]);
  });

  it('allows viewers to read but not generate', () => {
    const readRoles = Reflect.getMetadata(
      ROLES_KEY,
      OnboardingGuidesController.prototype.listGuides,
    );
    const generateRoles = Reflect.getMetadata(
      ROLES_KEY,
      OnboardingGuidesController.prototype.generateGuides,
    );

    expect(readRoles).toEqual([
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.MEMBER,
      WorkspaceRole.VIEWER,
    ]);
    expect(generateRoles).toEqual([
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.MEMBER,
    ]);
  });

  it('marks generation and regeneration responses as HTTP 202', () => {
    expect(
      Reflect.getMetadata(
        HTTP_CODE_METADATA,
        OnboardingGuidesController.prototype.generateGuides,
      ),
    ).toBe(202);
    expect(
      Reflect.getMetadata(
        HTTP_CODE_METADATA,
        OnboardingGuidesController.prototype.regenerateGuides,
      ),
    ).toBe(202);
  });

  it('passes route scope and filters through unchanged', async () => {
    const user = { sub: 'user-1' } as never;
    await controller.listGuides('workspace-1', 'repository-1', user, {
      type: undefined,
      q: 'billing',
    });
    await controller.getLatestGenerationRun(
      'workspace-1',
      'repository-1',
      user,
    );
    await controller.getGuide('workspace-1', 'repository-1', 'guide-1', user);
    await controller.generateGuides('workspace-1', 'repository-1', user, {});
    await controller.regenerateGuides('workspace-1', 'repository-1', user, {});

    expect(service.listGuides).toHaveBeenCalledWith(
      'workspace-1',
      'repository-1',
      'user-1',
      undefined,
      'billing',
    );
    expect(service.getLatestGenerationRun).toHaveBeenCalledWith(
      'workspace-1',
      'repository-1',
      'user-1',
    );
    expect(service.getGuide).toHaveBeenCalledWith(
      'workspace-1',
      'repository-1',
      'guide-1',
      'user-1',
    );
    expect(service.generateGuides).toHaveBeenCalledWith(
      'workspace-1',
      'repository-1',
      'user-1',
      undefined,
    );
    expect(service.regenerateGuides).toHaveBeenCalledWith(
      'workspace-1',
      'repository-1',
      'user-1',
      undefined,
    );
  });
});
