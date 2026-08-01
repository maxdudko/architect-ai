import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './axios';
import {
  generateOnboardingGuides,
  getLatestOnboardingGuideRun,
  getOnboardingGuide,
  listOnboardingGuides,
  regenerateOnboardingGuides,
} from './onboarding-guide';
import type { GenerateOnboardingGuidesPayload } from './onboarding-guide';

vi.mock('./axios', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('onboarding guide api client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists guides using the repository route and supplied query parameters', async () => {
    const response = { guides: [], total: 0 };
    vi.mocked(apiClient.get).mockResolvedValue({ data: response });

    await expect(
      listOnboardingGuides('workspace-1', 'repository-1', {
        type: 'MODULE',
        q: 'billing',
      }),
    ).resolves.toBe(response);

    expect(apiClient.get).toHaveBeenCalledWith(
      '/workspaces/workspace-1/repositories/repository-1/guides',
      { params: { type: 'MODULE', q: 'billing' } },
    );
  });

  it('uses an empty query object when list filters are omitted', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { guides: [], total: 0 } });

    await listOnboardingGuides('workspace-1', 'repository-1');

    expect(apiClient.get).toHaveBeenCalledWith(
      '/workspaces/workspace-1/repositories/repository-1/guides',
      { params: {} },
    );
  });

  it('gets a guide by its nested repository route', async () => {
    const guide = { id: 'guide-1' };
    vi.mocked(apiClient.get).mockResolvedValue({ data: guide });

    await expect(getOnboardingGuide('workspace-1', 'repository-1', 'guide-1')).resolves.toBe(guide);

    expect(apiClient.get).toHaveBeenCalledWith(
      '/workspaces/workspace-1/repositories/repository-1/guides/guide-1',
    );
  });

  it.each([
    ['generate', generateOnboardingGuides],
    ['regenerate', regenerateOnboardingGuides],
  ] as const)('posts selected guide types to the %s route', async (route, request) => {
    const run = { id: 'run-1', status: 'QUEUED' };
    vi.mocked(apiClient.post).mockResolvedValue({ data: run });
    const payload: GenerateOnboardingGuidesPayload = { types: ['MODULE', 'SERVICE'] };

    await expect(request('workspace-1', 'repository-1', payload)).resolves.toBe(run);

    expect(apiClient.post).toHaveBeenCalledWith(
      `/workspaces/workspace-1/repositories/repository-1/guides/${route}`,
      payload,
    );
  });

  it('posts an empty body when generation types are omitted', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 'run-1' } });

    await generateOnboardingGuides('workspace-1', 'repository-1');

    expect(apiClient.post).toHaveBeenCalledWith(
      '/workspaces/workspace-1/repositories/repository-1/guides/generate',
      {},
    );
  });

  it('gets the latest generation run and preserves a null response', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: null });

    await expect(getLatestOnboardingGuideRun('workspace-1', 'repository-1')).resolves.toBeNull();

    expect(apiClient.get).toHaveBeenCalledWith(
      '/workspaces/workspace-1/repositories/repository-1/guides/generation-runs/latest',
    );
  });
});
