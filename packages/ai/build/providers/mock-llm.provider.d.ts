import type { LlmGenerateRequest, LlmGenerateResult, LlmProvider, LlmStreamEvent } from '../types.js';
export interface MockLlmProviderOptions {
    responseText?: string;
    model?: string;
    chunkSize?: number;
}
export declare class MockLlmProvider implements LlmProvider {
    readonly name = "mock";
    private readonly responseText;
    private readonly model;
    private readonly chunkSize;
    constructor(options?: MockLlmProviderOptions);
    generate(request: LlmGenerateRequest): Promise<LlmGenerateResult>;
    stream(request: LlmGenerateRequest): AsyncIterable<LlmStreamEvent>;
    private buildResponse;
}
