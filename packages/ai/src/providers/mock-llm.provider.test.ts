import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MockLlmProvider } from './mock-llm.provider.ts';

describe('MockLlmProvider', () => {
  it('generates a deterministic response', async () => {
    const provider = new MockLlmProvider({
      responseText: 'Hello from mock',
    });
    const result = await provider.generate({
      messages: [{ role: 'user', content: 'What is auth?' }],
    });
    assert.match(result.content, /Hello from mock/);
    assert.match(result.content, /What is auth\?/);
    assert.equal(result.model, 'mock-llm');
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
    assert.deepEqual(events[0], { type: 'token', text: 'ABCDE' });
    assert.equal(events.at(-1)?.type, 'done');
  });
});
