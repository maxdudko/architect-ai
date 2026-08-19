import type {
  LlmGenerateRequest,
  LlmGenerateResult,
  LlmMessage,
  LlmProvider,
  LlmStreamEvent,
  LlmUsage,
} from '../interfaces/llm-provider.interface';

export interface GeminiLlmProviderOptions {
  apiKey: string;
  defaultModel?: string;
  maxTokens?: number;
  baseUrl?: string;
}

const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_MAX_TOKENS = 2048;
const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

interface GeminiContentPart {
  text?: string;
}

interface GeminiContent {
  role?: string;
  parts: GeminiContentPart[];
}

interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{ content?: GeminiContent }>;
  usageMetadata?: GeminiUsageMetadata;
  modelVersion?: string;
}

/**
 * Google's Generative Language API. Unlike OpenAI/Grok, requests use
 * `contents` + `systemInstruction` instead of a flat `messages` array, and
 * streaming is plain SSE of successive `GenerateContentResponse` objects
 * rather than incremental deltas.
 */
export class GeminiLlmProvider implements LlmProvider {
  readonly name = 'gemini';
  private readonly apiKey: string;
  private readonly defaultModel: string;
  private readonly maxTokens: number;
  private readonly baseUrl: string;

  constructor(options: GeminiLlmProviderOptions) {
    this.apiKey = options.apiKey;
    this.defaultModel = options.defaultModel ?? DEFAULT_MODEL;
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
  }

  async generate(request: LlmGenerateRequest): Promise<LlmGenerateResult> {
    const model = request.model ?? this.defaultModel;
    const response = await fetch(
      `${this.baseUrl}/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(this.buildBody(request)),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Gemini generate failed (${response.status}): ${errorBody}`,
      );
    }

    const payload = (await response.json()) as GeminiGenerateContentResponse;
    return {
      content: extractText(payload),
      model: payload.modelVersion ?? model,
      usage: toUsage(payload.usageMetadata),
    };
  }

  async *stream(request: LlmGenerateRequest): AsyncIterable<LlmStreamEvent> {
    const model = request.model ?? this.defaultModel;
    const response = await fetch(
      `${this.baseUrl}/models/${model}:streamGenerateContent?alt=sse`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(this.buildBody(request)),
      },
    );

    if (!response.ok || !response.body) {
      const errorBody = await response.text();
      throw new Error(
        `Gemini stream failed (${response.status}): ${errorBody}`,
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
        if (!data) {
          continue;
        }

        const chunk = JSON.parse(data) as GeminiGenerateContentResponse;
        if (chunk.modelVersion) {
          finalModel = chunk.modelVersion;
        }

        const delta = extractText(chunk);
        if (delta) {
          content += delta;
          yield { type: 'token', text: delta };
        }

        if (chunk.usageMetadata) {
          usage = toUsage(chunk.usageMetadata);
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

  private buildBody(request: LlmGenerateRequest): Record<string, unknown> {
    const { system, contents } = toGeminiContents(request.messages);
    return {
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents,
      generationConfig: {
        maxOutputTokens: request.maxTokens ?? this.maxTokens,
        ...(request.temperature !== undefined
          ? { temperature: request.temperature }
          : {}),
      },
    };
  }

  private headers(): Record<string, string> {
    return {
      'content-type': 'application/json',
      'x-goog-api-key': this.apiKey,
    };
  }
}

function toGeminiContents(messages: LlmMessage[]): {
  system: string | undefined;
  contents: GeminiContent[];
} {
  const systemParts: string[] = [];
  const contents: GeminiContent[] = [];

  for (const message of messages) {
    if (message.role === 'system') {
      systemParts.push(message.content);
      continue;
    }
    contents.push({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    });
  }

  return {
    system: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
    contents,
  };
}

function extractText(payload: GeminiGenerateContentResponse): string {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((part) => part.text ?? '')
    .filter(Boolean)
    .join('');
}

function toUsage(usage: GeminiUsageMetadata | undefined): LlmUsage | undefined {
  if (!usage) {
    return undefined;
  }
  return {
    inputTokens: usage.promptTokenCount,
    outputTokens: usage.candidatesTokenCount,
  };
}
