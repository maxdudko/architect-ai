import { ConfigService } from '@nestjs/config';
import { TokenCipherService } from '../common/crypto/token-cipher.service';
import { OpenAiLlmProvider } from '../modules/llm/providers/openai-llm.provider';
import { WorkspaceAiService } from './workspace-ai.service';
import { WorkspaceLlmResolver } from './workspace-llm.resolver';

describe('WorkspaceLlmResolver', () => {
  const hostedProvider = { name: 'mock-llm' };
  let workspaceAiService: { getEncryptedKey: jest.Mock };
  let tokenCipherService: { decrypt: jest.Mock };
  let configService: { get: jest.Mock };
  let resolver: WorkspaceLlmResolver;

  beforeEach(() => {
    workspaceAiService = { getEncryptedKey: jest.fn() };
    tokenCipherService = { decrypt: jest.fn() };
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'OPENAI_CHAT_MODEL') return 'gpt-4o-mini';
        if (key === 'LLM_MAX_TOKENS') return '2048';
        return undefined;
      }),
    };
    resolver = new WorkspaceLlmResolver(
      workspaceAiService as unknown as WorkspaceAiService,
      tokenCipherService as unknown as TokenCipherService,
      configService as unknown as ConfigService,
      hostedProvider as never,
    );
  });

  it('returns the hosted provider when no workspace key is stored', async () => {
    workspaceAiService.getEncryptedKey.mockResolvedValue(null);

    await expect(resolver.resolve('workspace-1')).resolves.toBe(hostedProvider);
  });

  it('builds an OpenAI provider from the decrypted workspace key', async () => {
    workspaceAiService.getEncryptedKey.mockResolvedValue('encrypted-key');
    tokenCipherService.decrypt.mockReturnValue('sk-live-secret');

    const provider = await resolver.resolve('workspace-1');

    expect(tokenCipherService.decrypt).toHaveBeenCalledWith('encrypted-key');
    expect(provider).toBeInstanceOf(OpenAiLlmProvider);
    expect(provider.name).toBe('openai');
  });
});
