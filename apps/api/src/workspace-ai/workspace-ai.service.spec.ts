import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WorkspaceRole } from '@prisma/client';
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
      deleteMany: jest.Mock;
    };
  };
  let tokenCipherService: { encrypt: jest.Mock; decrypt: jest.Mock };
  let workspacesService: { getWorkspaceForUser: jest.Mock };
  let configService: { get: jest.Mock };
  let service: WorkspaceAiService;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    prisma = {
      workspaceAiSettings: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    tokenCipherService = {
      encrypt: jest.fn(),
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
    service = new WorkspaceAiService(
      prisma as never,
      tokenCipherService as unknown as TokenCipherService,
      workspacesService as unknown as WorkspacesService,
      configService as unknown as ConfigService,
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
      service.testApiKey(workspaceId, userId, 'sk-test-secret-key'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('tests a pasted key without reading the saved key', async () => {
    fetchSpy.mockResolvedValue({ ok: true, status: 200 } as Response);

    await expect(
      service.testApiKey(workspaceId, userId, 'sk-pasted-key-1234'),
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
    expect(prisma.workspaceAiSettings.findUnique).not.toHaveBeenCalled();
    expect(tokenCipherService.decrypt).not.toHaveBeenCalled();
  });

  it('tests the saved key when no pasted key is provided', async () => {
    prisma.workspaceAiSettings.findUnique.mockResolvedValue({
      openaiApiKeyEncrypted: 'encrypted-key',
    });
    tokenCipherService.decrypt.mockReturnValue('sk-saved-key-9999');
    fetchSpy.mockResolvedValue({ ok: true, status: 200 } as Response);

    await expect(service.testApiKey(workspaceId, userId)).resolves.toEqual({
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
    prisma.workspaceAiSettings.findUnique.mockResolvedValue(null);

    await expect(service.testApiKey(workspaceId, userId)).rejects.toThrow(
      BadRequestException,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('maps OpenAI 401 responses to a rejected key', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 401 } as Response);

    await expect(
      service.testApiKey(workspaceId, userId, 'sk-invalid-key-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('maps network failures to a bad gateway', async () => {
    fetchSpy.mockRejectedValue(new TypeError('fetch failed'));

    await expect(
      service.testApiKey(workspaceId, userId, 'sk-test-secret-key'),
    ).rejects.toThrow(BadGatewayException);
  });
});
