import type { LlmGenerateRequest, LlmGenerateResult, LlmProvider, LlmStreamEvent } from '../types.js';
export interface AnthropicLlmProviderOptions {
    apiKey: string;
    defaultModel?: string;
    maxTokens?: number;
    baseUrl?: string;
}
export declare class AnthropicLlmProvider implements LlmProvider {
    readonly name = "anthropic";
    private readonly apiKey;
    private readonly defaultModel;
    private readonly maxTokens;
    private readonly baseUrl;
    constructor(options: AnthropicLlmProviderOptions);
    generate(request: LlmGenerateRequest): Promise<LlmGenerateResult>;
    stream(request: LlmGenerateRequest): AsyncIterable<LlmStreamEvent>;
    private headers;
}
