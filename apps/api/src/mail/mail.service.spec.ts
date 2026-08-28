import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { MailService } from './mail.service';

describe('MailService', () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  function createService(env: Record<string, string | undefined>): MailService {
    return new MailService({
      get: jest.fn((key: string) => env[key]),
    } as unknown as ConfigService);
  }

  function okResponse(): Response {
    return {
      ok: true,
      status: 200,
      text: () => Promise.resolve(''),
    } as Response;
  }

  function errorResponse(): Response {
    return {
      ok: false,
      status: 500,
      text: () => Promise.resolve('resend error'),
    } as Response;
  }

  function parseBody(callIndex = 0): Record<string, unknown> {
    const init = fetchSpy.mock.calls[callIndex]?.[1];
    const rawBody =
      init && typeof init === 'object' && 'body' in init
        ? init.body
        : undefined;
    if (typeof rawBody !== 'string') {
      throw new Error('Expected fetch body to be a JSON string');
    }

    const parsed: unknown = JSON.parse(rawBody);
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      throw new Error('Expected fetch body to be a JSON object');
    }

    return parsed as Record<string, unknown>;
  }

  it('sends a contact inquiry to sales with reply-to and escaped HTML', async () => {
    fetchSpy.mockResolvedValue(okResponse());
    const service = createService({
      RESEND_API_KEY: 're_test',
      MAIL_FROM: 'Architect AI <noreply@example.com>',
    });

    await service.sendContactInquiry({
      name: 'Jane <script>',
      email: 'jane@company.com',
      message: 'Hello <img>\nNeed help',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('https://api.resend.com/emails');
    const body = parseBody();
    expect(body.to).toEqual(['sales@architect.ai']);
    expect(body.reply_to).toBe('jane@company.com');
    expect(body.subject).toBe('Contact form: Jane <script>');
    expect(body.from).toBe('Architect AI <noreply@example.com>');
    expect(String(body.html)).toContain('Jane &lt;script&gt;');
    expect(String(body.html)).toContain('Hello &lt;img&gt;<br>Need help');
    expect(String(body.html)).not.toContain('<script>');
  });

  it('sends contact inquiries to CONTACT_TO_EMAIL when configured', async () => {
    fetchSpy.mockResolvedValue(okResponse());
    const service = createService({
      RESEND_API_KEY: 're_test',
      CONTACT_TO_EMAIL: 'me@example.com',
    });

    await service.sendContactInquiry({
      name: 'Ada',
      email: 'ada@example.com',
      message: 'Hi',
    });

    expect(parseBody().to).toEqual(['me@example.com']);
  });

  it('sends a contact acknowledgement to the visitor', async () => {
    fetchSpy.mockResolvedValue(okResponse());
    const service = createService({ RESEND_API_KEY: 're_test' });

    await service.sendContactAcknowledgement({
      name: 'Ada <b>',
      email: 'ada@example.com',
    });

    const body = parseBody();
    expect(body.to).toEqual(['ada@example.com']);
    expect(body.subject).toBe('We received your message');
    expect(body.reply_to).toBeUndefined();
    expect(String(body.html)).toContain('Hi Ada &lt;b&gt;,');
    expect(String(body.html)).not.toContain('<b>');
  });

  it('throws when sending a contact inquiry without RESEND_API_KEY', async () => {
    const service = createService({ RESEND_API_KEY: '' });

    await expect(
      service.sendContactInquiry({
        name: 'Ada',
        email: 'ada@example.com',
        message: 'Hi',
      }),
    ).rejects.toMatchObject({
      message: 'Email delivery is not configured',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('throws when Resend rejects a contact inquiry', async () => {
    fetchSpy.mockResolvedValue(errorResponse());
    const service = createService({ RESEND_API_KEY: 're_test' });

    await expect(
      service.sendContactInquiry({
        name: 'Ada',
        email: 'ada@example.com',
        message: 'Hi',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('skips invitation emails when RESEND_API_KEY is not set', async () => {
    const service = createService({});

    await service.sendWorkspaceInvitation({
      to: 'new@example.com',
      workspaceName: 'Acme',
      role: 'MEMBER',
      inviteUrl: 'http://localhost:3000/invitations/token',
      expiresAt: new Date('2026-09-01'),
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
