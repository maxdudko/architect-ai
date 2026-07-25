import { MockLlmProvider } from './mock-llm.provider';

describe('MockLlmProvider', () => {
  it('generates a deterministic response', async () => {
    const provider = new MockLlmProvider({
      responseText: 'Hello from mock',
    });
    const result = await provider.generate({
      messages: [{ role: 'user', content: 'What is auth?' }],
    });
    expect(result.content).toContain('Hello from mock');
    expect(result.content).toContain('What is auth?');
    expect(result.model).toBe('mock-llm');
  });

  it('streams tokens then a done event', async () => {
    const provider = new MockLlmProvider({
      responseText: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      chunkSize: 5,
    });
    const events = [];
    for await (const event of provider.stream({
      messages: [{ role: 'user', content: 'hi' }],
    })) {
      events.push(event);
    }
    expect(events[0]).toEqual({ type: 'token', text: 'ABCDE' });
    expect(events.at(-1)?.type).toBe('done');
  });
});
