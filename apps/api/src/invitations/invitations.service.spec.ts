import { UsageMetric, WorkspaceRole } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { MailService } from '../mail/mail.service';
import { MembershipsService } from '../memberships/memberships.service';
import { UsageService } from '../usage/usage.service';
import { UsersService } from '../users/users.service';
import { InvitationsRepository } from './invitations.repository';
import { InvitationsService } from './invitations.service';

describe('InvitationsService', () => {
  const workspaceId = 'workspace-1';
  const actorUserId = 'owner-1';
  const inviteEmail = 'new@architect.ai';

  let invitationsRepository: {
    create: jest.Mock;
    findPendingByWorkspaceAndEmail: jest.Mock;
    findPendingByToken: jest.Mock;
    findPendingByTokenWithWorkspace: jest.Mock;
    markAccepted: jest.Mock;
  };
  let membershipsService: {
    resolveActiveMembership: jest.Mock;
    addOrActivateMember: jest.Mock;
  };
  let usersService: { findByEmail: jest.Mock };
  let authService: { createSessionForUser: jest.Mock };
  let usageService: { assertWithinLimit: jest.Mock };
  let mailService: {
    buildInviteUrl: jest.Mock;
    sendWorkspaceInvitation: jest.Mock;
  };
  let service: InvitationsService;

  beforeEach(() => {
    invitationsRepository = {
      create: jest.fn(),
      findPendingByWorkspaceAndEmail: jest.fn(),
      findPendingByToken: jest.fn(),
      findPendingByTokenWithWorkspace: jest.fn(),
      markAccepted: jest.fn(),
    };
    membershipsService = {
      resolveActiveMembership: jest.fn().mockResolvedValue({
        membershipId: 'membership-1',
        role: WorkspaceRole.OWNER,
      }),
      addOrActivateMember: jest.fn().mockResolvedValue(undefined),
    };
    usersService = {
      findByEmail: jest.fn(),
    };
    authService = {
      createSessionForUser: jest.fn().mockResolvedValue({ accessToken: 'jwt' }),
    };
    usageService = {
      assertWithinLimit: jest.fn().mockResolvedValue(undefined),
    };
    mailService = {
      buildInviteUrl: jest.fn().mockReturnValue('https://app/invite/token-1'),
      sendWorkspaceInvitation: jest.fn().mockResolvedValue(undefined),
    };
    service = new InvitationsService(
      invitationsRepository as unknown as InvitationsRepository,
      membershipsService as unknown as MembershipsService,
      usersService as unknown as UsersService,
      authService as unknown as AuthService,
      mailService as unknown as MailService,
      usageService as unknown as UsageService,
    );
  });

  it('does not consume a member seat when sending an invitation', async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    invitationsRepository.findPendingByWorkspaceAndEmail.mockResolvedValue(
      null,
    );
    invitationsRepository.create.mockResolvedValue({
      id: 'inv-1',
      email: inviteEmail,
      role: WorkspaceRole.MEMBER,
      token: 'token-1',
      expiresAt,
    });
    invitationsRepository.findPendingByTokenWithWorkspace.mockResolvedValue({
      token: 'token-1',
      email: inviteEmail,
      role: WorkspaceRole.MEMBER,
      expiresAt,
      workspace: { name: 'Acme' },
    });

    await service.createInvitation(
      workspaceId,
      actorUserId,
      inviteEmail,
      WorkspaceRole.MEMBER,
    );

    expect(usageService.assertWithinLimit).not.toHaveBeenCalled();
    expect(invitationsRepository.create).toHaveBeenCalled();
  });

  it('enforces the members limit when a new member accepts an invitation', async () => {
    const user = { id: 'user-2', email: inviteEmail };
    invitationsRepository.findPendingByToken.mockResolvedValue({
      id: 'inv-1',
      workspaceId,
      email: inviteEmail,
      role: WorkspaceRole.MEMBER,
      expiresAt: new Date(Date.now() + 60_000),
    });
    usersService.findByEmail.mockResolvedValue(user);
    membershipsService.resolveActiveMembership.mockRejectedValueOnce(
      new Error('No active membership found for this workspace'),
    );

    await service.acceptInvitation('token-1', { email: inviteEmail });

    expect(usageService.assertWithinLimit).toHaveBeenCalledWith(
      workspaceId,
      UsageMetric.MEMBERS,
    );
    expect(membershipsService.addOrActivateMember).toHaveBeenCalledWith(
      workspaceId,
      user.id,
      WorkspaceRole.MEMBER,
    );
  });
});
