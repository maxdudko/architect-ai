import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProvider, WorkspaceRole } from '@prisma/client';
import { BillingService } from '../billing/billing.service';
import { TokenCipherService } from '../common/crypto/token-cipher.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { WorkspaceAiService } from './workspace-ai.service';

describe('WorkspaceAiService', () => {
  const workspaceId = 'workspace-1';
  const userId = 'user-1';
  let prisma: {
    workspaceAiSettings: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
      update: jest.Mock;
    };
    workspaceAiCredential: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      upsert: jest.Mock;
      deleteMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let tokenCipherService: { encrypt: jest.Mock; decrypt: jest.Mock };
  let workspacesService: { getWorkspaceForUser: jest.Mock };
  let configService: { get: jest.Mock };
  let billingService: { syncBillingModeForWorkspace: jest.Mock };
  let service: WorkspaceAiService;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    prisma = {
      workspaceAiSettings: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      workspaceAiCredential: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(async (arg: unknown) => {
        if (Array.isArray(arg)) {
          return Promise.all(arg);
        }
        if (typeof arg === 'function') {
          return (arg as (client: unknown) => Promise<unknown>)(prisma);
        }
        return undefined;
      }),
    };
    tokenCipherService = {
      encrypt: jest.fn((value: string) => `enc(${value})`),
      decrypt: jest.fn(),
    };
    workspacesService = {
      getWorkspaceForUser: jest.fn().mockResolvedValue({
        role: WorkspaceRole.OWNER,
      }),
    };
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'OPENAI_API_BASE_URL') {
          return 'https://api.openai.com/v1';
        }
        return undefined;
      }),
    };
    billingService = {
      syncBillingModeForWorkspace: jest.fn().mockResolvedValue(undefined),
    };
    service = new WorkspaceAiService(
      prisma as never,
      tokenCipherService as unknown as TokenCipherService,
      workspacesService as unknown as WorkspacesService,
      configService as unknown as ConfigService,
      billingService as unknown as BillingService,
    );
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('rejects members who cannot manage AI settings', async () => {
    workspacesService.getWorkspaceForUser.mockResolvedValue({
      role: WorkspaceRole.MEMBER,
    });

    await expect(
      service.testCredential(
        workspaceId,
        userId,
        AiProvider.OPENAI,
        'sk-test-secret-key',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('saves a credential and activates it', async () => {
    prisma.workspaceAiCredential.findMany.mockResolvedValue([
      {
        provider: AiProvider.OPENAI,
        keyLast4: '1234',
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
    prisma.workspaceAiSettings.findUnique.mockResolvedValue({
      workspaceId,
      activeProvider: AiProvider.OPENAI,
    });

    const result = await service.upsertCredential(
      workspaceId,
      userId,
      AiProvider.OPENAI,
      'sk-pasted-key-1234',
    );

    expect(tokenCipherService.encrypt).toHaveBeenCalledWith(
      'sk-pasted-key-1234',
    );
    expect(prisma.workspaceAiCredential.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId_provider: { workspaceId, provider: AiProvider.OPENAI },
        },
      }),
    );
    expect(result.activeProvider).toBe(AiProvider.OPENAI);
    expect(result.mode).toBe('BYOK');
    expect(billingService.syncBillingModeForWorkspace).toHaveBeenCalledWith(
      workspaceId,
    );
  });

  it('does not fail the request when billing sync throws', async () => {
    prisma.workspaceAiCredential.findMany.mockResolvedValue([]);
    prisma.workspaceAiSettings.findUnique.mockResolvedValue({
      workspaceId,
      activeProvider: AiProvider.OPENAI,
    });
    billingService.syncBillingModeForWorkspace.mockRejectedValue(
      new Error('stripe unavailable'),
    );

    await expect(
      service.upsertCredential(
        workspaceId,
        userId,
        AiProvider.OPENAI,
        'sk-pasted-key-1234',
      ),
    ).resolves.toBeDefined();
  });

  it('rejects activating a provider without a saved credential', async () => {
    prisma.workspaceAiCredential.findUnique.mockResolvedValue(null);

    await expect(
      service.setActiveProvider(workspaceId, userId, AiProvider.ANTHROPIC),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.workspaceAiSettings.upsert).not.toHaveBeenCalled();
  });

  it('allows switching back to hosted AI by clearing the active provider', async () => {
    prisma.workspaceAiSettings.findUnique.mockResolvedValue({
      workspaceId,
      activeProvider: null,
    });

    const result = await service.setActiveProvider(workspaceId, userId, null);

    expect(prisma.workspaceAiSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { activeProvider: null },
      }),
    );
    expect(result.mode).toBe('HOSTED');
  });

  it('tests a pasted key without reading the saved key', async () => {
    fetchSpy.mockResolvedValue({ ok: true, status: 200 } as Response);

    await expect(
      service.testCredential(
        workspaceId,
        userId,
        AiProvider.OPENAI,
        'sk-pasted-key-1234',
      ),
    ).resolves.toEqual({
      ok: true,
      message: 'OpenAI accepted this API key.',
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.openai.com/v1/models',
      expect.objectContaining({
        method: 'GET',
        headers: { authorization: 'Bearer sk-pasted-key-1234' },
      }),
    );
    expect(prisma.workspaceAiCredential.findUnique).not.toHaveBeenCalled();
    expect(tokenCipherService.decrypt).not.toHaveBeenCalled();
  });

  it('tests the saved key when no pasted key is provided', async () => {
    prisma.workspaceAiCredential.findUnique.mockResolvedValue({
      apiKeyEncrypted: 'encrypted-key',
    });
    tokenCipherService.decrypt.mockReturnValue('sk-saved-key-9999');
    fetchSpy.mockResolvedValue({ ok: true, status: 200 } as Response);

    await expect(
      service.testCredential(workspaceId, userId, AiProvider.OPENAI),
    ).resolves.toEqual({
      ok: true,
      message: 'OpenAI accepted the saved API key.',
    });
    expect(tokenCipherService.decrypt).toHaveBeenCalledWith('encrypted-key');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.openai.com/v1/models',
      expect.objectContaining({
        headers: { authorization: 'Bearer sk-saved-key-9999' },
      }),
    );
  });

  it('rejects when there is no pasted or saved key', async () => {
    prisma.workspaceAiCredential.findUnique.mockResolvedValue(null);

    await expect(
      service.testCredential(workspaceId, userId, AiProvider.OPENAI),
    ).rejects.toThrow(BadRequestException);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('maps OpenAI 401 responses to a rejected key', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 401 } as Response);

    await expect(
      service.testCredential(
        workspaceId,
        userId,
        AiProvider.OPENAI,
        'sk-invalid-key-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('maps network failures to a bad gateway', async () => {
    fetchSpy.mockRejectedValue(new TypeError('fetch failed'));

    await expect(
      service.testCredential(
        workspaceId,
        userId,
        AiProvider.OPENAI,
        'sk-test-secret-key',
      ),
    ).rejects.toThrow(BadGatewayException);
  });

  it('builds provider-specific test requests for Anthropic, Grok, and Gemini', async () => {
    fetchSpy.mockResolvedValue({ ok: true, status: 200 } as Response);

    await service.testCredential(
      workspaceId,
      userId,
      AiProvider.ANTHROPIC,
      'k1',
    );
    expect(fetchSpy).toHaveBeenLastCalledWith(
      'https://api.anthropic.com/v1/models',
      expect.objectContaining({
        headers: { 'x-api-key': 'k1', 'anthropic-version': '2023-06-01' },
      }),
    );

    await service.testCredential(workspaceId, userId, AiProvider.GROK, 'k2');
    expect(fetchSpy).toHaveBeenLastCalledWith(
      'https://api.x.ai/v1/models',
      expect.objectContaining({
        headers: { authorization: 'Bearer k2' },
      }),
    );

    await service.testCredential(workspaceId, userId, AiProvider.GEMINI, 'k3');
    expect(fetchSpy).toHaveBeenLastCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models',
      expect.objectContaining({
        headers: { 'x-goog-api-key': 'k3' },
      }),
    );
  });

  it('returns null active credential when no provider is active', async () => {
    prisma.workspaceAiSettings.findUnique.mockResolvedValue(null);

    await expect(service.getActiveCredential(workspaceId)).resolves.toBeNull();
  });

  it('decrypts the active credential', async () => {
    prisma.workspaceAiSettings.findUnique.mockResolvedValue({
      activeProvider: AiProvider.GEMINI,
    });
    prisma.workspaceAiCredential.findUnique.mockResolvedValue({
      apiKeyEncrypted: 'encrypted-gemini-key',
    });
    tokenCipherService.decrypt.mockReturnValue('gemini-secret');

    await expect(service.getActiveCredential(workspaceId)).resolves.toEqual({
      provider: AiProvider.GEMINI,
      apiKey: 'gemini-secret',
    });
  });
});
