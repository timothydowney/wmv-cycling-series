import { describe, it, expect } from 'vitest';
import { getDefaultSeason, getDefaultWeek } from '../defaultSelection';
import { Season, Week } from '../../types';

describe('Default Selection Logic', () => {
  const fall2025: Season = {
    id: 1,
    name: 'Fall 2025',
    start_at: Date.parse('2025-09-01T00:00:00Z') / 1000,
    end_at: Date.parse('2025-11-30T23:59:59Z') / 1000,
  };

  const spring2026: Season = {
    id: 2,
    name: 'Spring 2026',
    start_at: Date.parse('2026-03-01T00:00:00Z') / 1000,
    end_at: Date.parse('2026-05-31T23:59:59Z') / 1000,
  };

  const seasons = [fall2025, spring2026];

  const fallWeeks: Week[] = [
    {
      id: 101,
      season_id: 1,
      week_name: 'Week 1',
      strava_segment_id: '123',
      required_laps: 1,
      multiplier: 1,
      start_at: Date.parse('2025-09-02T00:00:00Z') / 1000,
      end_at: Date.parse('2025-09-02T23:59:59Z') / 1000,
    },
    {
      id: 112,
      season_id: 1,
      week_name: 'Week 12',
      strava_segment_id: '123',
      required_laps: 1,
      multiplier: 1,
      start_at: Date.parse('2025-11-25T00:00:00Z') / 1000,
      end_at: Date.parse('2025-11-25T23:59:59Z') / 1000,
    }
  ];

  const springWeeks: Week[] = [
    {
      id: 201,
      season_id: 2,
      week_name: 'Week 1',
      strava_segment_id: '456',
      required_laps: 1,
      multiplier: 1,
      start_at: Date.parse('2026-03-03T00:00:00Z') / 1000,
      end_at: Date.parse('2026-03-03T23:59:59Z') / 1000,
    },
    {
      id: 202,
      season_id: 2,
      week_name: 'Week 2',
      strava_segment_id: '456',
      required_laps: 1,
      multiplier: 1,
      start_at: Date.parse('2026-03-10T00:00:00Z') / 1000,
      end_at: Date.parse('2026-03-10T23:59:59Z') / 1000,
    }
  ];

  const toUnix = (isoDate: string) => Date.parse(isoDate) / 1000;

  describe('getDefaultSeason', () => {
    it('Tier 1: Should select active season when date is within range', () => {
      const result = getDefaultSeason(seasons, toUnix('2025-10-15T12:00:00Z'));
      expect(result?.id).toBe(1);
    });

    it('Tier 2: Should select recently closed season within grace period (1 day after)', () => {
      const result = getDefaultSeason(seasons, toUnix('2025-12-01T12:00:00Z'));
      expect(result?.id).toBe(1);
    });

    it('Tier 2: Should select recently closed season within grace period (7 days after)', () => {
      const result = getDefaultSeason(seasons, toUnix('2025-12-07T12:00:00Z'));
      expect(result?.id).toBe(1);
    });

    it('Tier 3: Should select upcoming season when outside grace period', () => {
      const result = getDefaultSeason(seasons, toUnix('2025-12-08T12:00:00Z'));
      expect(result?.id).toBe(2); // Should pick Spring 2026
    });

    it('Tier 3: Should select upcoming season during long gap (Jan 1, 2026)', () => {
      const result = getDefaultSeason(seasons, toUnix('2026-01-01T12:00:00Z'));
      expect(result?.id).toBe(2); // Should pick Spring 2026
    });
  });

  describe('getDefaultWeek', () => {
    it('Should select active week if today matches a week date', () => {
      const result = getDefaultWeek(fallWeeks, toUnix('2025-11-25T12:00:00Z'));
      expect(result?.id).toBe(112);
    });

    it('Should select last week if season is finished (Grace Period)', () => {
      const result = getDefaultWeek(fallWeeks, toUnix('2025-12-01T12:00:00Z'));
      expect(result?.id).toBe(112); // Last week of Fall
    });

    it('Should select FIRST week if season is upcoming (Tier 3)', () => {
      const result = getDefaultWeek(springWeeks, toUnix('2026-01-01T12:00:00Z'));
      expect(result?.id).toBe(201); // Week 1 of Spring
    });

    it('Should select active week during the season', () => {
      const result = getDefaultWeek(springWeeks, toUnix('2026-03-05T12:00:00Z'));
      expect(result?.id).toBe(201);
    });
  });
});
