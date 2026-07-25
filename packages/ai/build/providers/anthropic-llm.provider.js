const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_MAX_TOKENS = 2048;
const DEFAULT_BASE_URL = 'https://api.anthropic.com';
export class AnthropicLlmProvider {
    name = 'anthropic';
    apiKey;
    defaultModel;
    maxTokens;
    baseUrl;
    constructor(options) {
        this.apiKey = options.apiKey;
        this.defaultModel = options.defaultModel ?? DEFAULT_MODEL;
        this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
        this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    }
    async generate(request) {
        const { system, messages } = splitSystemMessages(request.messages);
        const model = request.model ?? this.defaultModel;
        const response = await fetch(`${this.baseUrl}/v1/messages`, {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify({
                model,
                max_tokens: request.maxTokens ?? this.maxTokens,
                temperature: request.temperature,
                system,
                messages,
            }),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Anthropic generate failed (${response.status}): ${errorBody}`);
        }
        const payload = (await response.json());
        const content = payload.content
            .filter((block) => block.type === 'text' && typeof block.text === 'string')
            .map((block) => block.text)
            .join('');
        return {
            content,
            model: payload.model,
            usage: toUsage(payload.usage),
        };
    }
    async *stream(request) {
        const { system, messages } = splitSystemMessages(request.messages);
        const model = request.model ?? this.defaultModel;
        const response = await fetch(`${this.baseUrl}/v1/messages`, {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify({
                model,
                max_tokens: request.maxTokens ?? this.maxTokens,
                temperature: request.temperature,
                system,
                messages,
                stream: true,
            }),
        });
        if (!response.ok || !response.body) {
            const errorBody = await response.text();
            throw new Error(`Anthropic stream failed (${response.status}): ${errorBody}`);
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let content = '';
        let finalModel = model;
        let usage;
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
                const event = JSON.parse(data);
                if (event.type === 'content_block_delta' &&
                    event.delta?.type === 'text_delta' &&
                    event.delta.text) {
                    content += event.delta.text;
                    yield { type: 'token', text: event.delta.text };
                }
                if (event.type === 'message_start' && event.message?.model) {
                    finalModel = event.message.model;
                }
                if (event.type === 'message_delta' && event.usage) {
                    usage = {
                        inputTokens: event.usage.input_tokens,
                        outputTokens: event.usage.output_tokens,
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
    headers() {
        return {
            'content-type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
        };
    }
}
function splitSystemMessages(messages) {
    const systemParts = [];
    const chatMessages = [];
    for (const message of messages) {
        if (message.role === 'system') {
            systemParts.push(message.content);
            continue;
        }
        chatMessages.push({
            role: message.role,
            content: message.content,
        });
    }
    return {
        system: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
        messages: chatMessages,
    };
}
function toUsage(usage) {
    if (!usage) {
        return undefined;
    }
    return {
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
    };
}
