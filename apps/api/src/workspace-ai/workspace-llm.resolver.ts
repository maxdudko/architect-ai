import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TokenCipherService } from '../common/crypto/token-cipher.service';
import type { LlmProvider } from '../modules/llm/interfaces/llm-provider.interface';
import { LLM_PROVIDER } from '../modules/llm/interfaces/tokens';
import { OpenAiLlmProvider } from '../modules/llm/providers/openai-llm.provider';
import { WorkspaceAiService } from './workspace-ai.service';

@Injectable()
export class WorkspaceLlmResolver {
  constructor(
    private readonly workspaceAiService: WorkspaceAiService,
    private readonly tokenCipherService: TokenCipherService,
    private readonly configService: ConfigService,
    @Inject(LLM_PROVIDER) private readonly hostedProvider: LlmProvider,
  ) {}

  async resolve(workspaceId: string): Promise<LlmProvider> {
    const encryptedKey =
      await this.workspaceAiService.getEncryptedKey(workspaceId);
    if (!encryptedKey) {
      return this.hostedProvider;
    }

    const apiKey = this.tokenCipherService.decrypt(encryptedKey);
    const maxTokens = Number(
      this.configService.get<string>('LLM_MAX_TOKENS') ?? 2048,
    );
    return new OpenAiLlmProvider({
      apiKey,
      defaultModel:
        this.configService.get<string>('OPENAI_CHAT_MODEL') ?? 'gpt-4o-mini',
      maxTokens,
      baseUrl: this.configService.get<string>('OPENAI_API_BASE_URL'),
    });
  }
}
