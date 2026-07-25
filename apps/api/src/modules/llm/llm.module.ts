import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { LlmProvider } from './interfaces/llm-provider.interface';
import { LLM_PROVIDER } from './interfaces/tokens';
import { AnthropicLlmProvider } from './providers/anthropic-llm.provider';
import { MockLlmProvider } from './providers/mock-llm.provider';
import { OpenAiLlmProvider } from './providers/openai-llm.provider';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: LLM_PROVIDER,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): LlmProvider => {
        const provider =
          configService.get<string>('LLM_PROVIDER')?.toLowerCase() ?? 'mock';
        const maxTokens = Number(
          configService.get<string>('LLM_MAX_TOKENS') ?? 2048,
        );

        if (provider === 'anthropic') {
          const apiKey = configService.get<string>('ANTHROPIC_API_KEY');
          if (!apiKey) {
            throw new Error(
              'ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic',
            );
          }
          return new AnthropicLlmProvider({
            apiKey,
            defaultModel:
              configService.get<string>('ANTHROPIC_MODEL') ??
              'claude-sonnet-4-20250514',
            maxTokens,
          });
        }

        if (provider === 'openai') {
          const apiKey = configService.get<string>('OPENAI_API_KEY');
          if (!apiKey) {
            throw new Error(
              'OPENAI_API_KEY is required when LLM_PROVIDER=openai',
            );
          }
          return new OpenAiLlmProvider({
            apiKey,
            defaultModel:
              configService.get<string>('OPENAI_CHAT_MODEL') ?? 'gpt-4o-mini',
            maxTokens,
            baseUrl: configService.get<string>('OPENAI_API_BASE_URL'),
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
