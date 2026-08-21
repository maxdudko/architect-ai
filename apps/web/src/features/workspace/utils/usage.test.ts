import { describe, expect, it } from 'vitest';
import type { UsageMetricSnapshot } from '@/entities';
import { formatUsageLimit, formatUsageSummary, effectivePlanLimit } from './usage';

function snapshot(overrides: Partial<UsageMetricSnapshot> = {}): UsageMetricSnapshot {
  return {
    metric: 'AI_QUESTIONS',
    period: 'MONTHLY',
    used: 12,
    limit: 50,
    remaining: 38,
    ...overrides,
  };
}

describe('formatUsageLimit', () => {
  it('includes remaining for capped monthly metrics', () => {
    expect(formatUsageLimit(snapshot())).toBe('12 / 50 / month · 38 remaining');
  });

  it('labels a null limit as unlimited', () => {
    expect(
      formatUsageLimit(
        snapshot({
          limit: null,
          remaining: null,
          used: 50,
        }),
      ),
    ).toBe('50 / Unlimited / month');
  });

  it('omits the monthly suffix for current-period metrics', () => {
    expect(
      formatUsageLimit(
        snapshot({
          metric: 'REPOSITORIES',
          period: 'CURRENT',
          used: 1,
          limit: 1,
          remaining: 0,
        }),
      ),
    ).toBe('1 / 1 · 0 remaining');
  });
});

describe('formatUsageSummary', () => {
  it('joins plan and AI mode', () => {
    expect(formatUsageSummary({ id: 'plan-free', key: 'free', name: 'Free' }, 'HOSTED')).toBe(
      'Free plan · Hosted AI',
    );
    expect(formatUsageSummary({ id: 'plan-pro', key: 'pro', name: 'PRO' }, 'BYOK')).toBe(
      'PRO plan · BYOK',
    );
  });
});

describe('effectivePlanLimit', () => {
  it('uncaps AI questions and guides for BYOK', () => {
    expect(effectivePlanLimit(50, 'AI_QUESTIONS', true)).toBeNull();
    expect(effectivePlanLimit(3, 'GUIDE_GENERATIONS', true)).toBeNull();
    expect(effectivePlanLimit(1, 'REPOSITORIES', true)).toBe(1);
  });

  it('keeps hosted caps', () => {
    expect(effectivePlanLimit(50, 'AI_QUESTIONS', false)).toBe(50);
  });
});
