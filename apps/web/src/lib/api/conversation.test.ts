import { beforeEach, describe, expect, it, vi } from 'vitest';
import { streamChatMessage } from './conversation';

vi.mock('./axios', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/lib/auth/storage', () => ({
  loadAuthState: () => ({ accessToken: 'access-token' }),
}));

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return { ok: true, body } as unknown as Response;
}

describe('streamChatMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches events split across reads', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          sseResponse([
            'event: token\ndata: {"type":"token","text":"Hel',
            'lo"}\n\nevent: done\ndata: {"type":"done"}\n\n',
          ]),
        ),
    );

    const onToken = vi.fn();
    const onDone = vi.fn();

    await streamChatMessage(
      'workspace-1',
      'conversation-1',
      { content: 'hi' },
      { onToken, onDone },
    );

    expect(onToken).toHaveBeenCalledWith('Hello');
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('dispatches a trailing event that is missing its terminator', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          sseResponse([
            'event: token\ndata: {"type":"token","text":"Hi"}\n\nevent: done\ndata: {"type":"done"}',
          ]),
        ),
    );

    const onToken = vi.fn();
    const onDone = vi.fn();

    await streamChatMessage(
      'workspace-1',
      'conversation-1',
      { content: 'hi' },
      { onToken, onDone },
    );

    expect(onToken).toHaveBeenCalledWith('Hi');
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
