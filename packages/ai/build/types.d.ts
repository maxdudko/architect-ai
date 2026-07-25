export type LlmRole = 'system' | 'user' | 'assistant';
export interface LlmMessage {
    role: LlmRole;
    content: string;
}
export interface LlmGenerateRequest {
    messages: LlmMessage[];
    model?: string;
    maxTokens?: number;
    temperature?: number;
}
export interface LlmUsage {
    inputTokens?: number;
    outputTokens?: number;
}
export interface LlmGenerateResult {
    content: string;
    model: string;
    usage?: LlmUsage;
}
export type LlmStreamEvent = {
    type: 'token';
    text: string;
} | {
    type: 'done';
    content: string;
    model: string;
    usage?: LlmUsage;
};
export interface LlmProvider {
    readonly name: string;
    generate(request: LlmGenerateRequest): Promise<LlmGenerateResult>;
    stream(request: LlmGenerateRequest): AsyncIterable<LlmStreamEvent>;
}
export type LlmProviderName = 'anthropic' | 'mock';
export declare function providerLabel(provider: LlmProviderName): string;
