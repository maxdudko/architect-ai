import type {
  LlmGenerateRequest,
  LlmGenerateResult,
  LlmProvider,
  LlmStreamEvent,
} from '../interfaces/llm-provider.interface';

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
      options.responseText ??
      'This is a mock onboarding answer based on the retrieved sources.';
    this.model = options.model ?? 'mock-llm';
    this.chunkSize = options.chunkSize ?? 24;
  }

  generate(request: LlmGenerateRequest): Promise<LlmGenerateResult> {
    const content = this.buildResponse(request);
    return Promise.resolve({
      content,
      model: this.model,
      usage: {
        inputTokens: estimateTokens(
          request.messages.map((message) => message.content).join('\n'),
        ),
        outputTokens: estimateTokens(content),
      },
    });
  }

  stream(request: LlmGenerateRequest): AsyncIterable<LlmStreamEvent> {
    const content = this.buildResponse(request);
    const events: LlmStreamEvent[] = [];
    for (let index = 0; index < content.length; index += this.chunkSize) {
      events.push({
        type: 'token',
        text: content.slice(index, index + this.chunkSize),
      });
    }
    events.push({
      type: 'done',
      content,
      model: this.model,
      usage: {
        inputTokens: estimateTokens(
          request.messages.map((message) => message.content).join('\n'),
        ),
        outputTokens: estimateTokens(content),
      },
    });

    return {
      [Symbol.asyncIterator]() {
        let cursor = 0;
        return {
          next(): Promise<IteratorResult<LlmStreamEvent>> {
            if (cursor >= events.length) {
              return Promise.resolve({ done: true, value: undefined });
            }
            const value = events[cursor++];
            return Promise.resolve({ done: false, value });
          },
        };
      },
    };
  }

  private buildResponse(request: LlmGenerateRequest): string {
    const lastUser = [...request.messages]
      .reverse()
      .find((message) => message.role === 'user');
    if (!lastUser) {
      return this.responseText;
    }
    return `${this.responseText}\n\nYou asked: ${lastUser.content.slice(0, 200)}`;
  }
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}
