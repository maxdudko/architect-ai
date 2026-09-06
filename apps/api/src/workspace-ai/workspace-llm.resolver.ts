import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LlmProvider } from '../modules/llm/interfaces/llm-provider.interface';
import { LLM_PROVIDER } from '../modules/llm/interfaces/tokens';
import {
  buildLlmProvider,
  LLM_PROVIDER_DEFAULT_MODEL,
  type LlmProviderKind,
} from '../modules/llm/llm-provider.factory';
import { WorkspaceAiService } from './workspace-ai.service';

const PROVIDER_KIND: Record<string, LlmProviderKind> = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  GROK: 'grok',
  GEMINI: 'gemini',
};

@Injectable()
export class WorkspaceLlmResolver {
  constructor(
    private readonly workspaceAiService: WorkspaceAiService,
    private readonly configService: ConfigService,
    @Inject(LLM_PROVIDER) private readonly hostedProvider: LlmProvider,
  ) {}

  async resolve(workspaceId: string): Promise<LlmProvider> {
    const credential =
      await this.workspaceAiService.getActiveCredential(workspaceId);
    if (!credential) {
      return this.hostedProvider;
    }

    const providerKind = PROVIDER_KIND[credential.provider];
    const maxTokens = Number(
      this.configService.get<string>('LLM_MAX_TOKENS') ?? 2048,
    );
    const { envVar, fallback } = LLM_PROVIDER_DEFAULT_MODEL[providerKind];

    return buildLlmProvider(providerKind, {
      apiKey: credential.apiKey,
      model: this.configService.get<string>(envVar) ?? fallback,
      maxTokens,
      baseUrl:
        providerKind === 'openai'
          ? this.configService.get<string>('OPENAI_API_BASE_URL')
          : undefined,
    });
  }
}
