import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  buildLlmProvider,
  LLM_PROVIDER_DEFAULT_MODEL,
  type LlmProviderKind,
} from './llm-provider.factory';
import type { LlmProvider } from './interfaces/llm-provider.interface';
import { LLM_PROVIDER } from './interfaces/tokens';
import { MockLlmProvider } from './providers/mock-llm.provider';

const HOSTED_API_KEY_ENV: Record<LlmProviderKind, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  grok: 'GROK_API_KEY',
  gemini: 'GEMINI_API_KEY',
};

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: LLM_PROVIDER,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): LlmProvider => {
        const provider = configService
          .get<string>('LLM_PROVIDER')
          ?.toLowerCase();
        const maxTokens = Number(
          configService.get<string>('LLM_MAX_TOKENS') ?? 2048,
        );

        if (
          provider === 'openai' ||
          provider === 'anthropic' ||
          provider === 'grok' ||
          provider === 'gemini'
        ) {
          const apiKeyEnv = HOSTED_API_KEY_ENV[provider];
          const apiKey = configService.get<string>(apiKeyEnv);
          if (!apiKey) {
            throw new Error(
              `${apiKeyEnv} is required when LLM_PROVIDER=${provider}`,
            );
          }
          const { envVar, fallback } = LLM_PROVIDER_DEFAULT_MODEL[provider];
          return buildLlmProvider(provider, {
            apiKey,
            model: configService.get<string>(envVar) ?? fallback,
            maxTokens,
            baseUrl:
              provider === 'openai'
                ? configService.get<string>('OPENAI_API_BASE_URL')
                : undefined,
          });
        }

        return new MockLlmProvider({
          model: configService.get<string>('LLM_MOCK_MODEL') ?? 'mock-llm',
        });
      },
    },
  ],
  exports: [LLM_PROVIDER],
})
export class LlmModule {}
