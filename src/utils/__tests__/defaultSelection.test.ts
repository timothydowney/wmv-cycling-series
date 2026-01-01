import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { getDefaultSeason, getDefaultWeek } from '../defaultSelection';
import { Season, Week } from '../../types';

describe('Default Selection Logic', () => {
  // Mock data
  const fall2025: Season = {
    id: 1,
    name: "Fall 2025",
    startDate: "2025-09-01",
    endDate: "2025-11-30",
    isActive: true
  };

  const spring2026: Season = {
    id: 2,
    name: "Spring 2026",
    startDate: "2026-03-01",
    endDate: "2026-05-31",
    isActive: true
  };

  const seasons = [fall2025, spring2026];

  const fallWeeks: Week[] = [
    { id: 101, seasonId: 1, weekName: "Week 1", date: "2025-09-02", segmentId: 123, requiredLaps: 1, startTime: "2025-09-02T00:00:00Z", endTime: "2025-09-02T23:59:59Z" },
    { id: 112, seasonId: 1, weekName: "Week 12", date: "2025-11-25", segmentId: 123, requiredLaps: 1, startTime: "2025-11-25T00:00:00Z", endTime: "2025-11-25T23:59:59Z" }
  ];

  const springWeeks: Week[] = [
    { id: 201, seasonId: 2, weekName: "Week 1", date: "2026-03-03", segmentId: 456, requiredLaps: 1, startTime: "2026-03-03T00:00:00Z", endTime: "2026-03-03T23:59:59Z" },
    { id: 202, seasonId: 2, weekName: "Week 2", date: "2026-03-10", segmentId: 456, requiredLaps: 1, startTime: "2026-03-10T00:00:00Z", endTime: "2026-03-10T23:59:59Z" }
  ];

  const allWeeks = [...fallWeeks, ...springWeeks];

  // Helper to mock system time
  const mockDate = (isoDate: string) => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(isoDate));
  };

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getDefaultSeason', () => {
    it('Tier 1: Should select active season when date is within range', () => {
      mockDate("2025-10-15"); // Middle of Fall 2025
      const result = getDefaultSeason(seasons);
      expect(result?.id).toBe(1);
    });

    it('Tier 2: Should select recently closed season within grace period (1 day after)', () => {
      mockDate("2025-12-01"); // 1 day after Fall 2025 ends
      const result = getDefaultSeason(seasons);
      expect(result?.id).toBe(1);
    });

    it('Tier 2: Should select recently closed season within grace period (7 days after)', () => {
      mockDate("2025-12-07"); // 7 days after Fall 2025 ends
      const result = getDefaultSeason(seasons);
      expect(result?.id).toBe(1);
    });

    it('Tier 3: Should select upcoming season when outside grace period', () => {
      mockDate("2025-12-08"); // 8 days after Fall 2025 ends
      const result = getDefaultSeason(seasons);
      expect(result?.id).toBe(2); // Should pick Spring 2026
    });

    it('Tier 3: Should select upcoming season during long gap (Jan 1, 2026)', () => {
      mockDate("2026-01-01"); // New Year 2026
      const result = getDefaultSeason(seasons);
      expect(result?.id).toBe(2); // Should pick Spring 2026
    });
  });

  describe('getDefaultWeek', () => {
    it('Should select active week if today matches a week date', () => {
      mockDate("2025-11-25"); // Date of Week 12
      const result = getDefaultWeek(fallWeeks, 1);
      expect(result?.id).toBe(112);
    });

    it('Should select last week if season is finished (Grace Period)', () => {
      mockDate("2025-12-01"); // After season
      const result = getDefaultWeek(fallWeeks, 1);
      expect(result?.id).toBe(112); // Last week of Fall
    });

    it('Should select FIRST week if season is upcoming (Tier 3)', () => {
      mockDate("2026-01-01"); // Before Spring 2026 starts
      const result = getDefaultWeek(springWeeks, 2);
      expect(result?.id).toBe(201); // Week 1 of Spring
    });

    it('Should select active week during the season', () => {
        mockDate("2026-03-05"); // Between Week 1 and Week 2
        // Logic usually picks the *next* week or *last* week depending on implementation.
        // Our implementation sorts by date.
        // If we are strictly *after* Week 1 but *before* Week 2.
        // The logic: `weeks.find(w => w.date >= todayStr)`
        // 2026-03-05 >= 2026-03-03 (Week 1)? No, wait.
        // "2026-03-03" < "2026-03-05".
        // "2026-03-10" > "2026-03-05".
        // So it should find Week 2.
        const result = getDefaultWeek(springWeeks, 2);
        expect(result?.id).toBe(202);
    });
  });
});
