import type {
  LlmGenerateRequest,
  LlmGenerateResult,
  LlmProvider,
  LlmStreamEvent,
} from '../types.js';

export interface MockLlmProviderOptions {
  responseText?: string;
  model?: string;
  chunkSize?: number;
}

export class MockLlmProvider implements LlmProvider {
  readonly name = 'mock';
  private readonly responseText: string;
  private readonly model: string;
  private readonly chunkSize: number;

  constructor(options: MockLlmProviderOptions = {}) {
    this.responseText =
      options.responseText ?? 'This is a mock onboarding answer based on the retrieved sources.';
    this.model = options.model ?? 'mock-llm';
    this.chunkSize = options.chunkSize ?? 24;
  }

  async generate(request: LlmGenerateRequest): Promise<LlmGenerateResult> {
    const content = this.buildResponse(request);
    return {
      content,
      model: this.model,
      usage: {
        inputTokens: estimateTokens(request.messages.map((message) => message.content).join('\n')),
        outputTokens: estimateTokens(content),
      },
    };
  }

  async *stream(request: LlmGenerateRequest): AsyncIterable<LlmStreamEvent> {
    const content = this.buildResponse(request);
    for (let index = 0; index < content.length; index += this.chunkSize) {
      yield {
        type: 'token',
        text: content.slice(index, index + this.chunkSize),
      };
    }
    yield {
      type: 'done',
      content,
      model: this.model,
      usage: {
        inputTokens: estimateTokens(request.messages.map((message) => message.content).join('\n')),
        outputTokens: estimateTokens(content),
      },
    };
  }

  private buildResponse(request: LlmGenerateRequest): string {
    const lastUser = [...request.messages].reverse().find((message) => message.role === 'user');
    if (!lastUser) {
      return this.responseText;
    }
    return `${this.responseText}\n\nYou asked: ${lastUser.content.slice(0, 200)}`;
  }
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}
