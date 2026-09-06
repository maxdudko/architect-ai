import { ConfigService } from '@nestjs/config';
import { AiProvider } from '@prisma/client';
import { GeminiLlmProvider } from '../modules/llm/providers/gemini-llm.provider';
import { GrokLlmProvider } from '../modules/llm/providers/grok-llm.provider';
import { OpenAiLlmProvider } from '../modules/llm/providers/openai-llm.provider';
import { WorkspaceAiService } from './workspace-ai.service';
import { WorkspaceLlmResolver } from './workspace-llm.resolver';

describe('WorkspaceLlmResolver', () => {
  const hostedProvider = { name: 'mock-llm' };
  let workspaceAiService: { getActiveCredential: jest.Mock };
  let configService: { get: jest.Mock };
  let resolver: WorkspaceLlmResolver;

  beforeEach(() => {
    workspaceAiService = { getActiveCredential: jest.fn() };
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'OPENAI_CHAT_MODEL') return 'gpt-4o-mini';
        if (key === 'LLM_MAX_TOKENS') return '2048';
        return undefined;
      }),
    };
    resolver = new WorkspaceLlmResolver(
      workspaceAiService as unknown as WorkspaceAiService,
      configService as unknown as ConfigService,
      hostedProvider as never,
    );
  });

  it('returns the hosted provider when no workspace key is stored', async () => {
    workspaceAiService.getActiveCredential.mockResolvedValue(null);

    await expect(resolver.resolve('workspace-1')).resolves.toBe(hostedProvider);
  });

  it('builds an OpenAI provider from the active workspace credential', async () => {
    workspaceAiService.getActiveCredential.mockResolvedValue({
      provider: AiProvider.OPENAI,
      apiKey: 'sk-live-secret',
    });

    const provider = await resolver.resolve('workspace-1');

    expect(provider).toBeInstanceOf(OpenAiLlmProvider);
    expect(provider.name).toBe('openai');
  });

  it('builds a Grok provider from the active workspace credential', async () => {
    workspaceAiService.getActiveCredential.mockResolvedValue({
      provider: AiProvider.GROK,
      apiKey: 'grok-secret',
    });

    const provider = await resolver.resolve('workspace-1');

    expect(provider).toBeInstanceOf(GrokLlmProvider);
    expect(provider.name).toBe('grok');
  });

  it('builds a Gemini provider from the active workspace credential', async () => {
    workspaceAiService.getActiveCredential.mockResolvedValue({
      provider: AiProvider.GEMINI,
      apiKey: 'gemini-secret',
    });

    const provider = await resolver.resolve('workspace-1');

    expect(provider).toBeInstanceOf(GeminiLlmProvider);
    expect(provider.name).toBe('gemini');
  });
});
