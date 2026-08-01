import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GuideType, OnboardingGuideGenerationRun } from '@/entities';
import { generateOnboardingGuides, listOnboardingGuides } from '@/lib/api';
import {
  ONBOARDING_GUIDE_QUERY_KEYS,
  useGenerateOnboardingGuidesMutation,
  useLatestOnboardingGuideRunQuery,
  useOnboardingGuidesQuery,
} from './use-onboarding-guides';

interface QueryOptions {
  queryKey: readonly unknown[];
  enabled: boolean;
  queryFn: () => unknown;
  refetchInterval?: (query: {
    state: { data: OnboardingGuideGenerationRun | null | undefined };
  }) => number | false;
}

interface MutationOptions {
  mutationFn: (types?: GuideType[]) => unknown;
  onSuccess: (run: OnboardingGuideGenerationRun) => void;
}

const state = vi.hoisted(() => ({
  queryOptions: undefined as unknown,
  mutationOptions: undefined as unknown,
  queryResult: { data: undefined } as { data: unknown },
  refs: [] as Array<{ current: unknown }>,
  refCursor: 0,
  invalidateQueries: vi.fn(),
  setQueryData: vi.fn(),
}));

vi.mock('react', () => ({
  useEffect: (effect: () => void) => effect(),
  useRef: (initialValue: unknown) => {
    const index = state.refCursor++;
    state.refs[index] ??= { current: initialValue };
    return state.refs[index];
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => {
    state.queryOptions = options;
    return state.queryResult;
  },
  useMutation: (options: unknown) => {
    state.mutationOptions = options;
    return { mutate: vi.fn() };
  },
  useQueryClient: () => ({
    invalidateQueries: state.invalidateQueries,
    setQueryData: state.setQueryData,
  }),
}));

vi.mock('@/lib/api', () => ({
  generateOnboardingGuides: vi.fn(),
  getLatestOnboardingGuideRun: vi.fn(),
  getOnboardingGuide: vi.fn(),
  listOnboardingGuides: vi.fn(),
  regenerateOnboardingGuides: vi.fn(),
}));

function generationRun(
  status: OnboardingGuideGenerationRun['status'],
  createdAt = '2026-07-31T12:00:00.000Z',
): OnboardingGuideGenerationRun {
  return {
    id: 'run-1',
    workspaceId: 'workspace-1',
    repositoryId: 'repository-1',
    trigger: 'MANUAL_GENERATE',
    status,
    requestedTypes: ['MODULE'],
    totalGuideCount: 1,
    completedGuideCount: status === 'SUCCEEDED' ? 1 : 0,
    sourceIndexingRunId: null,
    sourceCommitSha: null,
    error: null,
    errors: null,
    createdAt,
    startedAt: null,
    completedAt: null,
    updatedAt: createdAt,
  };
}

function resetRefCursor() {
  state.refCursor = 0;
}

describe('onboarding guide query keys', () => {
  it('builds stable scoped keys for lists, details, and generation runs', () => {
    expect(ONBOARDING_GUIDE_QUERY_KEYS.root('workspace-1', 'repository-1')).toEqual([
      'workspaces',
      'workspace-1',
      'repositories',
      'repository-1',
      'guides',
    ]);
    expect(
      ONBOARDING_GUIDE_QUERY_KEYS.list('workspace-1', 'repository-1', 'MODULE', 'billing'),
    ).toEqual([
      'workspaces',
      'workspace-1',
      'repositories',
      'repository-1',
      'guides',
      'list',
      'MODULE',
      'billing',
    ]);
    expect(ONBOARDING_GUIDE_QUERY_KEYS.list('workspace-1', 'repository-1')).toEqual([
      'workspaces',
      'workspace-1',
      'repositories',
      'repository-1',
      'guides',
      'list',
      null,
      null,
    ]);
  });
});

describe('useOnboardingGuidesQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.refs = [];
    resetRefCursor();
  });

  it('passes filters to the API and disables incomplete repository queries', async () => {
    useOnboardingGuidesQuery('', 'repository-1', { type: 'SERVICE', q: 'worker' });
    const options = state.queryOptions as QueryOptions;

    expect(options.enabled).toBe(false);
    await options.queryFn();
    expect(listOnboardingGuides).toHaveBeenCalledWith('', 'repository-1', {
      type: 'SERVICE',
      q: 'worker',
    });
  });
});

describe('latest generation run polling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-31T12:10:00.000Z'));
    state.refs = [];
    state.queryResult = { data: undefined };
    resetRefCursor();
  });

  it('polls active recent runs and stops for terminal or stale runs', () => {
    useLatestOnboardingGuideRunQuery('workspace-1', 'repository-1');
    const interval = (state.queryOptions as QueryOptions).refetchInterval;

    expect(interval?.({ state: { data: generationRun('QUEUED') } })).toBe(2500);
    expect(interval?.({ state: { data: generationRun('RUNNING') } })).toBe(2500);
    expect(interval?.({ state: { data: generationRun('SUCCEEDED') } })).toBe(false);
    expect(
      interval?.({
        state: { data: generationRun('RUNNING', '2026-07-31T11:54:59.000Z') },
      }),
    ).toBe(false);
    expect(interval?.({ state: { data: null } })).toBe(false);
  });

  it('invalidates the repository guide scope when an active run succeeds', () => {
    state.queryResult = { data: generationRun('RUNNING') };
    useLatestOnboardingGuideRunQuery('workspace-1', 'repository-1');

    resetRefCursor();
    state.queryResult = { data: generationRun('SUCCEEDED') };
    useLatestOnboardingGuideRunQuery('workspace-1', 'repository-1');

    expect(state.invalidateQueries).toHaveBeenCalledOnce();
    expect(state.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ONBOARDING_GUIDE_QUERY_KEYS.root('workspace-1', 'repository-1'),
    });
  });

  it('does not invalidate for an initial successful result', () => {
    state.queryResult = { data: generationRun('SUCCEEDED') };

    useLatestOnboardingGuideRunQuery('workspace-1', 'repository-1');

    expect(state.invalidateQueries).not.toHaveBeenCalled();
  });
});

describe('guide generation mutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.refs = [];
    resetRefCursor();
  });

  it('sends selected types and seeds the latest-run cache on success', async () => {
    const run = generationRun('QUEUED');
    vi.mocked(generateOnboardingGuides).mockResolvedValue(run);
    useGenerateOnboardingGuidesMutation('workspace-1', 'repository-1');
    const options = state.mutationOptions as MutationOptions;

    await options.mutationFn(['MODULE', 'SERVICE']);
    options.onSuccess(run);

    expect(generateOnboardingGuides).toHaveBeenCalledWith('workspace-1', 'repository-1', {
      types: ['MODULE', 'SERVICE'],
    });
    expect(state.setQueryData).toHaveBeenCalledWith(
      ONBOARDING_GUIDE_QUERY_KEYS.latestRun('workspace-1', 'repository-1'),
      run,
    );
  });
});
