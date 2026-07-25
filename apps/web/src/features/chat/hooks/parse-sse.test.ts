import { describe, expect, it } from 'vitest';
import { parseSseChunk } from './parse-sse';

describe('parseSseChunk', () => {
  it('parses event and data lines', () => {
    const events = parseSseChunk(
      'event: token\ndata: {"type":"token","text":"Hello"}\n\nevent: done\ndata: {"type":"done"}\n\n',
    );
    expect(events).toEqual([
      { event: 'token', data: { type: 'token', text: 'Hello' } },
      { event: 'done', data: { type: 'done' } },
    ]);
  });
});
