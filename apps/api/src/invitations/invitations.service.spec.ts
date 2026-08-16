import { UsageMetric, UsagePeriod, WorkspaceRole } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { MailService } from '../mail/mail.service';
import { MembershipsService } from '../memberships/memberships.service';
import { UsageLimitExceededException } from '../usage/usage-limit.exception';
import { UsageService } from '../usage/usage.service';
import { UsersService } from '../users/users.service';
import { InvitationsRepository } from './invitations.repository';
import { InvitationsService } from './invitations.service';

describe('InvitationsService', () => {
  const workspaceId = 'workspace-1';
  const actorUserId = 'owner-1';

  let invitationsRepository: {
    create: jest.Mock;
    findPendingByWorkspaceAndEmail: jest.Mock;
  };
  let membershipsService: { resolveActiveMembership: jest.Mock };
  let usageService: { assertWithinLimit: jest.Mock };
  let service: InvitationsService;

  beforeEach(() => {
    invitationsRepository = {
      create: jest.fn(),
      findPendingByWorkspaceAndEmail: jest.fn(),
    };
    membershipsService = {
      resolveActiveMembership: jest.fn().mockResolvedValue({
        membershipId: 'membership-1',
        role: WorkspaceRole.OWNER,
      }),
    };
    usageService = {
      assertWithinLimit: jest.fn().mockResolvedValue(undefined),
    };
    service = new InvitationsService(
      invitationsRepository as unknown as InvitationsRepository,
      membershipsService as unknown as MembershipsService,
      {} as UsersService,
      {} as AuthService,
      {} as MailService,
      usageService as unknown as UsageService,
    );
  });

  it('does not create an invitation when the member seat limit is exceeded', async () => {
    usageService.assertWithinLimit.mockRejectedValue(
      new UsageLimitExceededException({
        metric: UsageMetric.MEMBERS,
        used: 3,
        limit: 3,
        period: UsagePeriod.CURRENT,
      }),
    );

    await expect(
      service.createInvitation(
        workspaceId,
        actorUserId,
        'new@architect.ai',
        WorkspaceRole.MEMBER,
      ),
    ).rejects.toBeInstanceOf(UsageLimitExceededException);
    expect(usageService.assertWithinLimit).toHaveBeenCalledWith(
      workspaceId,
      UsageMetric.MEMBERS,
      { memberCountMode: 'seats' },
    );
    expect(invitationsRepository.create).not.toHaveBeenCalled();
  });
});
