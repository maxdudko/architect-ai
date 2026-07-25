import type {
  LlmGenerateRequest,
  LlmGenerateResult,
  LlmProvider,
  LlmStreamEvent,
  LlmUsage,
} from '../interfaces/llm-provider.interface';

export interface OpenAiLlmProviderOptions {
  apiKey: string;
  defaultModel?: string;
  maxTokens?: number;
  baseUrl?: string;
}

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_MAX_TOKENS = 2048;
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

interface OpenAiChatResponse {
  model: string;
  choices: Array<{
    message?: { content?: string | null };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

interface OpenAiStreamChunk {
  model?: string;
  choices?: Array<{
    delta?: { content?: string | null };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  } | null;
}

export class OpenAiLlmProvider implements LlmProvider {
  readonly name = 'openai';
  private readonly apiKey: string;
  private readonly defaultModel: string;
  private readonly maxTokens: number;
  private readonly baseUrl: string;

  constructor(options: OpenAiLlmProviderOptions) {
    this.apiKey = options.apiKey;
    this.defaultModel = options.defaultModel ?? DEFAULT_MODEL;
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
  }

  async generate(request: LlmGenerateRequest): Promise<LlmGenerateResult> {
    const model = request.model ?? this.defaultModel;
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model,
        max_completion_tokens: request.maxTokens ?? this.maxTokens,
        temperature: request.temperature,
        messages: request.messages,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `OpenAI generate failed (${response.status}): ${errorBody}`,
      );
    }

    const payload = (await response.json()) as OpenAiChatResponse;
    const content = payload.choices[0]?.message?.content ?? '';

    return {
      content,
      model: payload.model,
      usage: toUsage(payload.usage),
    };
  }

  async *stream(request: LlmGenerateRequest): AsyncIterable<LlmStreamEvent> {
    const model = request.model ?? this.defaultModel;
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model,
        max_completion_tokens: request.maxTokens ?? this.maxTokens,
        temperature: request.temperature,
        messages: request.messages,
        stream: true,
        stream_options: { include_usage: true },
      }),
    });

    if (!response.ok || !response.body) {
      const errorBody = await response.text();
      throw new Error(
        `OpenAI stream failed (${response.status}): ${errorBody}`,
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    let finalModel = model;
    let usage: LlmUsage | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) {
          continue;
        }
        const data = trimmed.slice(5).trim();
        if (!data || data === '[DONE]') {
          continue;
        }

        const chunk = JSON.parse(data) as OpenAiStreamChunk;
        if (chunk.model) {
          finalModel = chunk.model;
        }

        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          content += delta;
          yield { type: 'token', text: delta };
        }

        if (chunk.usage) {
          usage = {
            inputTokens: chunk.usage.prompt_tokens,
            outputTokens: chunk.usage.completion_tokens,
          };
        }
      }
    }

    yield {
      type: 'done',
      content,
      model: finalModel,
      usage,
    };
  }

  private headers(): Record<string, string> {
    return {
      'content-type': 'application/json',
      authorization: `Bearer ${this.apiKey}`,
    };
  }
}

function toUsage(
  usage:
    | {
        prompt_tokens: number;
        completion_tokens: number;
      }
    | undefined,
): LlmUsage | undefined {
  if (!usage) {
    return undefined;
  }
  return {
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
  };
}
