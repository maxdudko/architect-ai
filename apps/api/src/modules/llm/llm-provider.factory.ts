import type { LlmProvider } from './interfaces/llm-provider.interface';
import { AnthropicLlmProvider } from './providers/anthropic-llm.provider';
import { GeminiLlmProvider } from './providers/gemini-llm.provider';
import { GrokLlmProvider } from './providers/grok-llm.provider';
import { OpenAiLlmProvider } from './providers/openai-llm.provider';

/** Lowercase provider kind shared by the `LLM_PROVIDER` env var and BYOK settings. */
export type LlmProviderKind = 'openai' | 'anthropic' | 'grok' | 'gemini';

export const LLM_PROVIDER_KINDS: LlmProviderKind[] = [
  'openai',
  'anthropic',
  'grok',
  'gemini',
];

export interface BuildLlmProviderOptions {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  baseUrl?: string;
}

/** Env var each provider reads its default chat model from, and a sane fallback. */
export const LLM_PROVIDER_DEFAULT_MODEL: Record<
  LlmProviderKind,
  { envVar: string; fallback: string }
> = {
  openai: { envVar: 'OPENAI_CHAT_MODEL', fallback: 'gpt-4o-mini' },
  anthropic: {
    envVar: 'ANTHROPIC_MODEL',
    fallback: 'claude-sonnet-4-20250514',
  },
  grok: { envVar: 'GROK_MODEL', fallback: 'grok-4.6' },
  gemini: { envVar: 'GEMINI_MODEL', fallback: 'gemini-2.5-flash' },
};

/**
 * Single place that turns a provider kind + credentials into an `LlmProvider`
 * instance. Shared by the hosted `LLM_PROVIDER` factory (llm.module.ts) and
 * the workspace BYOK resolver so adapter construction never drifts between
 * the two call sites.
 */
export function buildLlmProvider(
  provider: LlmProviderKind,
  options: BuildLlmProviderOptions,
): LlmProvider {
  switch (provider) {
    case 'openai':
      return new OpenAiLlmProvider({
        apiKey: options.apiKey,
        defaultModel: options.model,
        maxTokens: options.maxTokens,
        baseUrl: options.baseUrl,
      });
    case 'anthropic':
      return new AnthropicLlmProvider({
        apiKey: options.apiKey,
        defaultModel: options.model,
        maxTokens: options.maxTokens,
        baseUrl: options.baseUrl,
      });
    case 'grok':
      return new GrokLlmProvider({
        apiKey: options.apiKey,
        defaultModel: options.model,
        maxTokens: options.maxTokens,
        baseUrl: options.baseUrl,
      });
    case 'gemini':
      return new GeminiLlmProvider({
        apiKey: options.apiKey,
        defaultModel: options.model,
        maxTokens: options.maxTokens,
        baseUrl: options.baseUrl,
      });
  }
}
