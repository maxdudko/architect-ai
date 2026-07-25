export class MockLlmProvider {
    name = 'mock';
    responseText;
    model;
    chunkSize;
    constructor(options = {}) {
        this.responseText =
            options.responseText ?? 'This is a mock onboarding answer based on the retrieved sources.';
        this.model = options.model ?? 'mock-llm';
        this.chunkSize = options.chunkSize ?? 24;
    }
    async generate(request) {
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
    async *stream(request) {
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
    buildResponse(request) {
        const lastUser = [...request.messages].reverse().find((message) => message.role === 'user');
        if (!lastUser) {
            return this.responseText;
        }
        return `${this.responseText}\n\nYou asked: ${lastUser.content.slice(0, 200)}`;
    }
}
function estimateTokens(text) {
    return Math.max(1, Math.ceil(text.length / 4));
}
