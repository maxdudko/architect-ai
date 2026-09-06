import { OpenAiLlmProvider } from './openai-llm.provider';

export interface GrokLlmProviderOptions {
  apiKey: string;
  defaultModel?: string;
  maxTokens?: number;
  baseUrl?: string;
}

const DEFAULT_MODEL = 'grok-4.6';
const DEFAULT_BASE_URL = 'https://api.x.ai/v1';

/**
 * xAI's Grok API mirrors the OpenAI chat-completions request/response shape
 * (including SSE streaming), so this reuses `OpenAiLlmProvider` with Grok's
 * base URL, default model, and provider name.
 */
export class GrokLlmProvider extends OpenAiLlmProvider {
  constructor(options: GrokLlmProviderOptions) {
    super({
      apiKey: options.apiKey,
      defaultModel: options.defaultModel ?? DEFAULT_MODEL,
      maxTokens: options.maxTokens,
      baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
      name: 'grok',
    });
  }
}
