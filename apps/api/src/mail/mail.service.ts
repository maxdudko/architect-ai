import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface WorkspaceInvitationEmailParams {
  to: string;
  workspaceName: string;
  role: string;
  inviteUrl: string;
  expiresAt: Date;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendWorkspaceInvitation(
    params: WorkspaceInvitationEmailParams,
  ): Promise<void> {
    const { to, workspaceName, role, inviteUrl, expiresAt } = params;
    const apiKey = this.configService.get<string>('RESEND_API_KEY');

    if (!apiKey) {
      this.logger.log(
        `RESEND_API_KEY not set — invitation email not sent. Invite link: ${inviteUrl}`,
      );
      return;
    }

    const from =
      this.configService.get<string>('MAIL_FROM') ??
      'Architect AI <onboarding@resend.dev>';

    const expiresLabel = expiresAt.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `You've been invited to join ${workspaceName}`,
        html: `
          <p>You've been invited to join <strong>${workspaceName}</strong> on Architect AI as a <strong>${role.toLowerCase()}</strong>.</p>
          <p><a href="${inviteUrl}">Accept invitation</a></p>
          <p>This link expires on ${expiresLabel}.</p>
          <p>If you did not expect this invitation, you can ignore this email.</p>
        `,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(
        `Failed to send invitation email to ${to}: ${response.status} ${errorBody}`,
      );
      throw new ServiceUnavailableException('Failed to send invitation email');
    }
  }

  buildInviteUrl(token: string): string {
    const webUrl = (
      this.configService.get<string>('WEB_URL') ?? 'http://localhost:3000'
    ).replace(/\/$/, '');
    return `${webUrl}/invitations/${token}`;
  }
}
