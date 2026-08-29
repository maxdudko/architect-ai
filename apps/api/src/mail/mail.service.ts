import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEFAULT_MAIL_FROM = 'Architect AI <onboarding@resend.dev>';
const DEFAULT_CONTACT_TO_EMAIL = 'sales@architect.ai';

export interface WorkspaceInvitationEmailParams {
  to: string;
  workspaceName: string;
  role: string;
  inviteUrl: string;
  expiresAt: Date;
}

export interface ContactInquiryEmailParams {
  name: string;
  email: string;
  message: string;
}

export interface ContactAcknowledgementEmailParams {
  name: string;
  email: string;
}

export interface PasswordResetEmailParams {
  to: string;
  resetUrl: string;
  expiresAt: Date;
}

export interface OauthSignInReminderEmailParams {
  to: string;
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  failureMessage: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendWorkspaceInvitation(
    params: WorkspaceInvitationEmailParams,
  ): Promise<void> {
    const { to, workspaceName, role, inviteUrl, expiresAt } = params;

    if (!this.getResendApiKey()) {
      this.logger.log(
        `RESEND_API_KEY not set — invitation email not sent. Invite link: ${inviteUrl}`,
      );
      return;
    }

    const expiresLabel = expiresAt.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    await this.sendEmail({
      to,
      subject: `You've been invited to join ${workspaceName}`,
      html: `
          <p>You've been invited to join <strong>${workspaceName}</strong> on Architect AI as a <strong>${role.toLowerCase()}</strong>.</p>
          <p><a href="${inviteUrl}">Accept invitation</a></p>
          <p>This link expires on ${expiresLabel}.</p>
          <p>If you did not expect this invitation, you can ignore this email.</p>
        `,
      failureMessage: 'Failed to send invitation email',
    });
  }

  async sendContactInquiry(params: ContactInquiryEmailParams): Promise<void> {
    const name = escapeHtml(params.name);
    const email = escapeHtml(params.email);
    const message = escapeHtml(params.message).replace(/\r\n|\r|\n/g, '<br>');

    await this.sendEmail({
      to: this.getContactToEmail(),
      replyTo: params.email,
      subject: `Contact form: ${params.name}`,
      html: `
          <p>New contact form message from Architect AI.</p>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Message:</strong></p>
          <p>${message}</p>
        `,
      failureMessage: 'Failed to send contact message',
    });
  }

  async sendContactAcknowledgement(
    params: ContactAcknowledgementEmailParams,
  ): Promise<void> {
    const name = escapeHtml(params.name);

    await this.sendEmail({
      to: params.email,
      subject: 'We received your message',
      html: `
          <p>Hi ${name},</p>
          <p>Thanks for contacting Architect AI. We received your message and will get back to you soon.</p>
        `,
      failureMessage: 'Failed to send contact acknowledgement',
    });
  }

  async sendPasswordReset(params: PasswordResetEmailParams): Promise<void> {
    const { to, resetUrl, expiresAt } = params;

    if (!this.getResendApiKey()) {
      this.logger.log(
        `RESEND_API_KEY not set — password reset email not sent. Reset link: ${resetUrl}`,
      );
      return;
    }

    const expiresLabel = expiresAt.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    const safeResetUrl = escapeHtml(resetUrl);

    await this.sendEmail({
      to,
      subject: 'Reset your Architect AI password',
      html: `
          <p>We received a request to reset the password for your Architect AI account.</p>
          <p><a href="${safeResetUrl}">Reset password</a></p>
          <p>This link expires on ${expiresLabel}.</p>
          <p>If you did not request a password reset, you can ignore this email.</p>
        `,
      failureMessage: 'Failed to send password reset email',
    });
  }

  async sendOauthSignInReminder(
    params: OauthSignInReminderEmailParams,
  ): Promise<void> {
    const { to } = params;

    if (!this.getResendApiKey()) {
      this.logger.log(
        `RESEND_API_KEY not set — OAuth sign-in reminder not sent to ${to}`,
      );
      return;
    }

    await this.sendEmail({
      to,
      subject: 'Sign in to Architect AI',
      html: `
          <p>We received a password reset request for this email, but this Architect AI account signs in with Google or GitHub.</p>
          <p>Use <strong>Continue with Google</strong> or <strong>Continue with GitHub</strong> on the sign-in page instead.</p>
          <p>If you did not request this, you can ignore this email.</p>
        `,
      failureMessage: 'Failed to send OAuth sign-in reminder',
    });
  }

  buildInviteUrl(token: string): string {
    return `${this.getWebUrl()}/invitations/${token}`;
  }

  buildPasswordResetUrl(token: string): string {
    return `${this.getWebUrl()}/reset-password/${encodeURIComponent(token)}`;
  }

  private getWebUrl(): string {
    return (
      this.configService.get<string>('WEB_URL') ?? 'http://localhost:3000'
    ).replace(/\/$/, '');
  }

  private getContactToEmail(): string {
    const configured = this.configService
      .get<string>('CONTACT_TO_EMAIL')
      ?.trim();
    return configured || DEFAULT_CONTACT_TO_EMAIL;
  }

  private getResendApiKey(): string | undefined {
    const apiKey = this.configService.get<string>('RESEND_API_KEY')?.trim();
    return apiKey || undefined;
  }

  private async sendEmail(params: SendEmailParams): Promise<void> {
    const apiKey = this.getResendApiKey();
    if (!apiKey) {
      this.logger.error(
        'RESEND_API_KEY is not set — contact and transactional email cannot be sent',
      );
      throw new ServiceUnavailableException('Email delivery is not configured');
    }

    const from =
      this.configService.get<string>('MAIL_FROM') ?? DEFAULT_MAIL_FROM;

    const payload: Record<string, unknown> = {
      from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
    };
    if (params.replyTo) {
      payload.reply_to = params.replyTo;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(
        `${params.failureMessage} to ${params.to}: ${response.status} ${errorBody}`,
      );
      throw new ServiceUnavailableException(params.failureMessage);
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
