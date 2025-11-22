/**
 * Tests for database row type guards
 *
 * Validates runtime type checking for all database row types
 */

import {
  isParticipantRow,
  isSegmentRow,
  isSeasonRow,
  isWeekRow,
  isActivityRow,
  isSegmentEffortRow,
  isResultRow,
  isCountRow,
  ParticipantRow,
  SegmentRow,
  SeasonRow,
  WeekRow,
  ActivityRow,
  SegmentEffortRow,
  ResultRow,
  CountRow
} from '../types/database';

describe('Database Type Guards', () => {
  describe('isParticipantRow', () => {
    it('should accept valid ParticipantRow', () => {
      const valid: ParticipantRow = {
        strava_athlete_id: 123456,
        name: 'Test User',
        created_at: '2025-11-22T12:00:00Z'
      };
      expect(isParticipantRow(valid)).toBe(true);
    });

    it('should reject row missing strava_athlete_id', () => {
      const invalid = {
        name: 'Test User',
        created_at: '2025-11-22T12:00:00Z'
      };
      expect(isParticipantRow(invalid)).toBe(false);
    });

    it('should reject row with wrong strava_athlete_id type', () => {
      const invalid = {
        strava_athlete_id: '123456',
        name: 'Test User',
        created_at: '2025-11-22T12:00:00Z'
      };
      expect(isParticipantRow(invalid)).toBe(false);
    });

    it('should reject row missing name', () => {
      const invalid = {
        strava_athlete_id: 123456,
        created_at: '2025-11-22T12:00:00Z'
      };
      expect(isParticipantRow(invalid)).toBe(false);
    });

    it('should reject row missing created_at', () => {
      const invalid = {
        strava_athlete_id: 123456,
        name: 'Test User'
      };
      expect(isParticipantRow(invalid)).toBe(false);
    });

    it('should reject null', () => {
      expect(isParticipantRow(null)).toBe(false);
    });

    it('should reject undefined', () => {
      expect(isParticipantRow(undefined)).toBe(false);
    });
  });

  describe('isSegmentRow', () => {
    it('should accept valid SegmentRow with all fields', () => {
      const valid: SegmentRow = {
        strava_segment_id: 987654,
        name: 'Lookout Mountain',
        distance: 2500,
        average_grade: 6.5,
        city: 'Denver',
        state: 'CO',
        country: 'USA',
        created_at: '2025-11-22T12:00:00Z'
      };
      expect(isSegmentRow(valid)).toBe(true);
    });

    it('should accept SegmentRow with optional fields null', () => {
      const valid: SegmentRow = {
        strava_segment_id: 987654,
        name: 'Lookout Mountain',
        distance: null,
        average_grade: null,
        city: null,
        state: null,
        country: null,
        created_at: '2025-11-22T12:00:00Z'
      };
      expect(isSegmentRow(valid)).toBe(true);
    });

    it('should accept SegmentRow without optional fields', () => {
      const valid = {
        strava_segment_id: 987654,
        name: 'Lookout Mountain',
        created_at: '2025-11-22T12:00:00Z'
      };
      expect(isSegmentRow(valid)).toBe(true);
    });

    it('should reject row missing strava_segment_id', () => {
      const invalid = {
        name: 'Lookout Mountain',
        created_at: '2025-11-22T12:00:00Z'
      };
      expect(isSegmentRow(invalid)).toBe(false);
    });

    it('should reject row with wrong name type', () => {
      const invalid = {
        strava_segment_id: 987654,
        name: 12345,
        created_at: '2025-11-22T12:00:00Z'
      };
      expect(isSegmentRow(invalid)).toBe(false);
    });
  });

  describe('isSeasonRow', () => {
    it('should accept valid SeasonRow', () => {
      const valid: SeasonRow = {
        id: 1,
        name: 'Fall 2025',
        start_at: 1698969600,
        end_at: 1704067200,
        is_active: 1,
        created_at: '2025-11-22T12:00:00Z'
      };
      expect(isSeasonRow(valid)).toBe(true);
    });

    it('should reject row missing id', () => {
      const invalid = {
        name: 'Fall 2025',
        start_at: 1698969600,
        end_at: 1704067200,
        is_active: 1,
        created_at: '2025-11-22T12:00:00Z'
      };
      expect(isSeasonRow(invalid)).toBe(false);
    });

    it('should reject row with is_active as boolean instead of number', () => {
      const invalid = {
        id: 1,
        name: 'Fall 2025',
        start_at: 1698969600,
        end_at: 1704067200,
        is_active: true,
        created_at: '2025-11-22T12:00:00Z'
      };
      expect(isSeasonRow(invalid)).toBe(false);
    });

    it('should reject row with string timestamps', () => {
      const invalid = {
        id: 1,
        name: 'Fall 2025',
        start_at: '1698969600',
        end_at: '1704067200',
        is_active: 1,
        created_at: '2025-11-22T12:00:00Z'
      };
      expect(isSeasonRow(invalid)).toBe(false);
    });
  });

  describe('isWeekRow', () => {
    it('should accept valid WeekRow with notes', () => {
      const valid: WeekRow = {
        id: 1,
        season_id: 1,
        week_name: 'Week 1: Season Opener',
        strava_segment_id: 987654,
        required_laps: 2,
        start_at: 1699564800,
        end_at: 1699651200,
        notes: 'Lookout Mountain double',
        created_at: '2025-11-22T12:00:00Z'
      };
      expect(isWeekRow(valid)).toBe(true);
    });

    it('should accept WeekRow with null notes', () => {
      const valid: WeekRow = {
        id: 1,
        season_id: 1,
        week_name: 'Week 1: Season Opener',
        strava_segment_id: 987654,
        required_laps: 2,
        start_at: 1699564800,
        end_at: 1699651200,
        notes: null,
        created_at: '2025-11-22T12:00:00Z'
      };
      expect(isWeekRow(valid)).toBe(true);
    });

    it('should reject row missing week_name', () => {
      const invalid = {
        id: 1,
        season_id: 1,
        strava_segment_id: 987654,
        required_laps: 2,
        start_at: 1699564800,
        end_at: 1699651200,
        notes: null,
        created_at: '2025-11-22T12:00:00Z'
      };
      expect(isWeekRow(invalid)).toBe(false);
    });

    it('should reject row with string required_laps', () => {
      const invalid = {
        id: 1,
        season_id: 1,
        week_name: 'Week 1: Season Opener',
        strava_segment_id: 987654,
        required_laps: '2',
        start_at: 1699564800,
        end_at: 1699651200,
        notes: null,
        created_at: '2025-11-22T12:00:00Z'
      };
      expect(isWeekRow(invalid)).toBe(false);
    });
  });

  describe('isActivityRow', () => {
    it('should accept valid ActivityRow with device_name', () => {
      const valid: ActivityRow = {
        id: 1,
        week_id: 1,
        strava_athlete_id: 123456,
        strava_activity_id: 555555555,
        start_at: 1699564800,
        device_name: 'Garmin Edge 530',
        validation_status: 'valid',
        validation_message: null,
        validated_at: '2025-11-22T13:00:00Z',
        created_at: '2025-11-22T12:00:00Z'
      };
      expect(isActivityRow(valid)).toBe(true);
    });

    it('should accept ActivityRow with validation_status pending', () => {
      const valid: ActivityRow = {
        id: 1,
        week_id: 1,
        strava_athlete_id: 123456,
        strava_activity_id: 555555555,
        start_at: 1699564800,
        device_name: null,
        validation_status: 'pending',
        validation_message: null,
        validated_at: '2025-11-22T13:00:00Z',
        created_at: '2025-11-22T12:00:00Z'
      };
      expect(isActivityRow(valid)).toBe(true);
    });

    it('should reject row missing strava_activity_id', () => {
      const invalid = {
        id: 1,
        week_id: 1,
        strava_athlete_id: 123456,
        start_at: 1699564800,
        device_name: null,
        validation_status: 'valid',
        validation_message: null,
        validated_at: '2025-11-22T13:00:00Z',
        created_at: '2025-11-22T12:00:00Z'
      };
      expect(isActivityRow(invalid)).toBe(false);
    });

    it('should reject row with invalid validation_status', () => {
      const invalid = {
        id: 1,
        week_id: 1,
        strava_athlete_id: 123456,
        strava_activity_id: 555555555,
        start_at: 1699564800,
        device_name: null,
        validation_status: 'unknown',
        validation_message: null,
        validated_at: '2025-11-22T13:00:00Z',
        created_at: '2025-11-22T12:00:00Z'
      } as any;
      expect(isActivityRow(invalid)).toBe(false);
    });
  });

  describe('isSegmentEffortRow', () => {
    it('should accept valid SegmentEffortRow with pr_achieved', () => {
      const valid: SegmentEffortRow = {
        id: 1,
        activity_id: 1,
        strava_segment_id: 987654,
        strava_effort_id: 'effort123',
        effort_index: 0,
        elapsed_seconds: 580,
        start_at: 1699564800,
        pr_achieved: 1
      };
      expect(isSegmentEffortRow(valid)).toBe(true);
    });

    it('should accept SegmentEffortRow without PR', () => {
      const valid: SegmentEffortRow = {
        id: 1,
        activity_id: 1,
        strava_segment_id: 987654,
        strava_effort_id: null,
        effort_index: 1,
        elapsed_seconds: 620,
        start_at: 1699565400,
        pr_achieved: 0
      };
      expect(isSegmentEffortRow(valid)).toBe(true);
    });

    it('should reject row missing elapsed_seconds', () => {
      const invalid = {
        id: 1,
        activity_id: 1,
        strava_segment_id: 987654,
        strava_effort_id: null,
        effort_index: 0,
        start_at: 1699564800,
        pr_achieved: 0
      };
      expect(isSegmentEffortRow(invalid)).toBe(false);
    });

    it('should reject row with string pr_achieved', () => {
      const invalid = {
        id: 1,
        activity_id: 1,
        strava_segment_id: 987654,
        strava_effort_id: null,
        effort_index: 0,
        elapsed_seconds: 580,
        start_at: 1699564800,
        pr_achieved: '1'
      };
      expect(isSegmentEffortRow(invalid)).toBe(false);
    });
  });

  describe('isResultRow', () => {
    it('should accept valid ResultRow with activity_id', () => {
      const valid: ResultRow = {
        id: 1,
        week_id: 1,
        strava_athlete_id: 123456,
        activity_id: 555555555,
        total_time_seconds: 1200,
        created_at: '2025-11-22T12:00:00Z',
        updated_at: '2025-11-22T13:00:00Z'
      };
      expect(isResultRow(valid)).toBe(true);
    });

    it('should accept ResultRow without activity_id', () => {
      const valid: ResultRow = {
        id: 1,
        week_id: 1,
        strava_athlete_id: 123456,
        activity_id: null,
        total_time_seconds: 0,
        created_at: '2025-11-22T12:00:00Z',
        updated_at: '2025-11-22T13:00:00Z'
      };
      expect(isResultRow(valid)).toBe(true);
    });

    it('should reject row missing total_time_seconds', () => {
      const invalid = {
        id: 1,
        week_id: 1,
        strava_athlete_id: 123456,
        activity_id: null,
        created_at: '2025-11-22T12:00:00Z',
        updated_at: '2025-11-22T13:00:00Z'
      };
      expect(isResultRow(invalid)).toBe(false);
    });

    it('should reject row with string total_time_seconds', () => {
      const invalid = {
        id: 1,
        week_id: 1,
        strava_athlete_id: 123456,
        activity_id: null,
        total_time_seconds: '1200',
        created_at: '2025-11-22T12:00:00Z',
        updated_at: '2025-11-22T13:00:00Z'
      };
      expect(isResultRow(invalid)).toBe(false);
    });
  });

  describe('isCountRow', () => {
    it('should accept valid CountRow', () => {
      const valid: CountRow = {
        count: 42
      };
      expect(isCountRow(valid)).toBe(true);
    });

    it('should accept CountRow with zero count', () => {
      const valid: CountRow = {
        count: 0
      };
      expect(isCountRow(valid)).toBe(true);
    });

    it('should reject row missing count', () => {
      const invalid = {};
      expect(isCountRow(invalid)).toBe(false);
    });

    it('should reject row with string count', () => {
      const invalid = {
        count: '42'
      };
      expect(isCountRow(invalid)).toBe(false);
    });

    it('should reject null', () => {
      expect(isCountRow(null)).toBe(false);
    });

    it('should reject undefined', () => {
      expect(isCountRow(undefined)).toBe(false);
    });
  });
});
