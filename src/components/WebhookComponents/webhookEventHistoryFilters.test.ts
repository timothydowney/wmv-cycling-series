import { describe, expect, it } from 'vitest';
import {
  ALL_TIME_RANGE_SECONDS,
  DEFAULT_TIME_RANGE_SECONDS,
  getSinceTimestamp,
} from './webhookEventHistoryFilters';

describe('webhookEventHistoryFilters', () => {
  it('returns 0 for the all-time filter', () => {
    expect(getSinceTimestamp(ALL_TIME_RANGE_SECONDS, 1_700_000_000)).toBe(0);
  });

  it('returns an absolute unix timestamp for the default 7-day filter', () => {
    expect(getSinceTimestamp(DEFAULT_TIME_RANGE_SECONDS, 1_700_000_000)).toBe(1_699_395_200);
  });

  it('never returns a negative timestamp', () => {
    expect(getSinceTimestamp(DEFAULT_TIME_RANGE_SECONDS, 100)).toBe(0);
  });
});