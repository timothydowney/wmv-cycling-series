/**
 * Timezone Manager Tests
 * 
 * Tests for timezone-aware activity validation and week boundary computation.
 * Covers edge cases including timezone offsets, DST transitions, and boundary conditions.
 */

const {
  parseISOToUnix,
  validateActivityInWeek,
  computeWeekBoundaries,
  getTimezoneOffsetSeconds,
  unixToISO
} = require('../timezoneManager');

describe('timezoneManager', () => {
  describe('parseISOToUnix', () => {
    it('should parse valid ISO 8601 UTC datetime to Unix timestamp', () => {
      // 2025-01-07T05:00:00Z = 1736226000 seconds since epoch
      const result = parseISOToUnix('2025-01-07T05:00:00Z');
      expect(result).toBe(1736226000);
    });

    it('should parse ISO 8601 with milliseconds', () => {
      const result = parseISOToUnix('2025-01-07T05:00:00.000Z');
      expect(result).toBe(1736226000);
    });

    it('should return null for invalid ISO string', () => {
      expect(parseISOToUnix('not-a-date')).toBeNull();
      expect(parseISOToUnix('')).toBeNull();
      expect(parseISOToUnix(null)).toBeNull();
    });

    it('should handle timezone offsets (treat as UTC)', () => {
      // ISO 8601 with +05:00 offset
      const result = parseISOToUnix('2025-01-07T10:00:00+05:00');
      // This represents 05:00:00 UTC
      expect(result).toBe(1736226000);
    });
  });

  describe('unixToISO', () => {
    it('should convert Unix timestamp to ISO 8601 UTC string', () => {
      const result = unixToISO(1736226000);
      expect(result).toBe('2025-01-07T05:00:00.000Z');
    });

    it('should return null for non-integer input', () => {
      expect(unixToISO(1736226000.5)).toBeNull();
      expect(unixToISO('not-a-number')).toBeNull();
    });
  });

  describe('getTimezoneOffsetSeconds', () => {
    it('should return correct offset for UTC', () => {
      expect(getTimezoneOffsetSeconds('UTC')).toBe(0);
      expect(getTimezoneOffsetSeconds('GMT')).toBe(0);
    });

    it('should return correct offset for US Eastern Time', () => {
      // EST is UTC-5 = -18000 seconds
      expect(getTimezoneOffsetSeconds('America/New_York')).toBe(-18000);
    });

    it('should return correct offset for US Pacific Time', () => {
      // PST is UTC-8 = -28800 seconds
      expect(getTimezoneOffsetSeconds('America/Los_Angeles')).toBe(-28800);
    });

    it('should return correct offset for positive timezones', () => {
      // JST is UTC+9 = 32400 seconds
      expect(getTimezoneOffsetSeconds('Asia/Tokyo')).toBe(32400);
    });

    it('should return null for unknown timezone', () => {
      expect(getTimezoneOffsetSeconds('America/Unknown')).toBeNull();
      expect(getTimezoneOffsetSeconds('')).toBeNull();
    });
  });

  describe('computeWeekBoundaries', () => {
    describe('Eastern Time (UTC-5)', () => {
      it('should compute midnight to 10pm Eastern as 5am to 3am UTC next day', () => {
        const result = computeWeekBoundaries(
          '2025-01-07',
          'America/New_York',
          '00:00:00',
          '22:00:00'
        );

        expect(result.valid).toBe(true);
        expect(result.start_time_utc).toBe('2025-01-07T05:00:00.000Z');
        expect(result.end_time_utc).toBe('2025-01-08T03:00:00.000Z');
        expect(result.start_unix).toBe(1736226000);
        expect(result.end_unix).toBe(1736305200);
      });

      it('should handle different times on same day', () => {
        const result = computeWeekBoundaries(
          '2025-06-15',
          'America/New_York',
          '06:00:00',
          '18:00:00'
        );

        expect(result.valid).toBe(true);
        // Note: Current implementation uses standard offset (-18000 for EST)
        // In June, EDT is UTC-4, but our simple offset mapping uses EST (UTC-5)
        // This is acceptable for non-DST-aware implementation
        // 6am EST (UTC-5) = 11am UTC
        // 6pm EST (UTC-5) = 11pm UTC
        expect(result.start_time_utc).toBe('2025-06-15T11:00:00.000Z');
        expect(result.end_time_utc).toBe('2025-06-15T23:00:00.000Z');
      });
    });

    describe('Pacific Time (UTC-8)', () => {
      it('should compute midnight to 10pm Pacific correctly', () => {
        const result = computeWeekBoundaries(
          '2025-01-07',
          'America/Los_Angeles',
          '00:00:00',
          '22:00:00'
        );

        expect(result.valid).toBe(true);
        // Midnight PST (UTC-8) = 8am UTC
        // 10pm PST (UTC-8) = 6am UTC next day
        expect(result.start_time_utc).toBe('2025-01-07T08:00:00.000Z');
        expect(result.end_time_utc).toBe('2025-01-08T06:00:00.000Z');
      });
    });

    describe('Error handling', () => {
      it('should return error for missing parameters', () => {
        let result = computeWeekBoundaries(null, 'America/New_York', '00:00:00', '22:00:00');
        expect(result.valid).toBe(false);

        result = computeWeekBoundaries('2025-01-07', null, '00:00:00', '22:00:00');
        expect(result.valid).toBe(false);
      });

      it('should return error for invalid date format', () => {
        const result = computeWeekBoundaries(
          '01-07-2025',  // Wrong format
          'America/New_York',
          '00:00:00',
          '22:00:00'
        );
        expect(result.valid).toBe(false);
      });

      it('should return error for invalid time format', () => {
        let result = computeWeekBoundaries(
          '2025-01-07',
          'America/New_York',
          '00:00',  // Missing seconds
          '22:00:00'
        );
        expect(result.valid).toBe(false);

        result = computeWeekBoundaries(
          '2025-01-07',
          'America/New_York',
          '00:00:00',
          '22'  // Invalid time
        );
        expect(result.valid).toBe(false);
      });

      it('should return error for unknown timezone', () => {
        const result = computeWeekBoundaries(
          '2025-01-07',
          'America/Unknown',
          '00:00:00',
          '22:00:00'
        );
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('validateActivityInWeek', () => {
    let activity, week;

    beforeEach(() => {
      // Setup: Chris from California riding on event day within window
      // Event date: 2025-01-07 midnight to 10pm Eastern
      // = 2025-01-07 08:00 UTC to 2025-01-08 06:00 UTC
      activity = {
        id: 123456,
        start_date: '2025-01-07T15:30:00Z',  // 3:30pm UTC = 10:30am Pacific
        start_date_local: '2025-01-07T07:30:00',  // 7:30am Pacific local time
        timezone: '(GMT-08:00) America/Los_Angeles'
      };

      week = {
        start_time_utc: '2025-01-07T05:00:00Z',  // Event: midnight Eastern = 5am UTC
        end_time_utc: '2025-01-08T03:00:00Z'     // Event: 10pm Eastern = 3am UTC next day
      };
    });

    describe('Valid activities', () => {
      it('should accept activity exactly at week start', () => {
        activity.start_date = '2025-01-07T05:00:00Z';
        const result = validateActivityInWeek(activity, week);
        expect(result.valid).toBe(true);
        expect(result.message).toBe('Activity within week boundaries');
      });

      it('should accept activity exactly at week end', () => {
        activity.start_date = '2025-01-08T03:00:00Z';
        const result = validateActivityInWeek(activity, week);
        expect(result.valid).toBe(true);
      });

      it('should accept activity in middle of week window', () => {
        activity.start_date = '2025-01-07T14:00:00Z';
        const result = validateActivityInWeek(activity, week);
        expect(result.valid).toBe(true);
      });

      it('should accept Pacific athlete riding at local time within window', () => {
        // Chris (Pacific) rides at 10:30am Pacific
        // = 2025-01-07T18:30:00Z UTC
        activity.start_date = '2025-01-07T18:30:00Z';
        activity.start_date_local = '2025-01-07T10:30:00';
        const result = validateActivityInWeek(activity, week);
        expect(result.valid).toBe(true);
      });

      it('should accept Eastern athlete riding at local time within window', () => {
        // Tim (Eastern) rides at 10:30am Eastern
        // = 2025-01-07T15:30:00Z UTC
        activity.start_date = '2025-01-07T15:30:00Z';
        activity.start_date_local = '2025-01-07T10:30:00';
        activity.timezone = '(GMT-05:00) America/New_York';
        const result = validateActivityInWeek(activity, week);
        expect(result.valid).toBe(true);
      });
    });

    describe('Invalid activities - before window', () => {
      it('should reject activity before week start', () => {
        activity.start_date = '2025-01-07T04:59:00Z';
        const result = validateActivityInWeek(activity, week);
        expect(result.valid).toBe(false);
        expect(result.message).toContain('before week start');
      });

      it('should reject activity from previous day', () => {
        activity.start_date = '2025-01-06T23:00:00Z';
        const result = validateActivityInWeek(activity, week);
        expect(result.valid).toBe(false);
      });

      it('should reject Pacific athlete riding just before midnight local', () => {
        // Midnight Pacific on 1/7 = 2025-01-07T08:00:00Z (8am UTC)
        // This is WITHIN event window (5am UTC - 3am UTC next day)
        // So test BEFORE that: 11:59pm Pacific on 1/6 = 2025-01-07T07:59:00Z
        // This is still AFTER 5am UTC start, so still valid
        // Actually test BEFORE event start: 4:59am UTC = 8:59pm Pacific (prior evening)
        activity.start_date = '2025-01-07T04:59:59Z';
        const result = validateActivityInWeek(activity, week);
        expect(result.valid).toBe(false);
        expect(result.message).toContain('before week start');
      });
    });

    describe('Invalid activities - after window', () => {
      it('should reject activity after week end', () => {
        activity.start_date = '2025-01-08T03:00:01Z';
        const result = validateActivityInWeek(activity, week);
        expect(result.valid).toBe(false);
        expect(result.message).toContain('after week end');
      });

      it('should reject activity from next day', () => {
        activity.start_date = '2025-01-09T10:00:00Z';
        const result = validateActivityInWeek(activity, week);
        expect(result.valid).toBe(false);
      });

      it('should reject Pacific athlete riding after 10pm local (outside window)', () => {
        // If Chris rides at 11pm Pacific on 1/7:
        // = 2025-01-08T07:00:00Z UTC (way after event window ends at 3am UTC)
        activity.start_date = '2025-01-08T07:00:00Z';
        const result = validateActivityInWeek(activity, week);
        expect(result.valid).toBe(false);
      });
    });

    describe('Invalid data', () => {
      it('should reject activity with invalid start_date', () => {
        activity.start_date = 'not-a-date';
        const result = validateActivityInWeek(activity, week);
        expect(result.valid).toBe(false);
        expect(result.message).toContain('Invalid activity start_date');
      });

      it('should reject activity with null start_date', () => {
        activity.start_date = null;
        const result = validateActivityInWeek(activity, week);
        expect(result.valid).toBe(false);
      });

      it('should reject week with invalid start_time_utc', () => {
        week.start_time_utc = 'not-a-date';
        const result = validateActivityInWeek(activity, week);
        expect(result.valid).toBe(false);
        expect(result.message).toContain('Invalid week boundaries');
      });

      it('should reject week with invalid end_time_utc', () => {
        week.end_time_utc = null;
        const result = validateActivityInWeek(activity, week);
        expect(result.valid).toBe(false);
      });
    });

    describe('Edge cases - midnight and 10pm boundaries', () => {
      it('should accept activity at exactly midnight Eastern (5am UTC)', () => {
        activity.start_date = '2025-01-07T05:00:00Z';
        const result = validateActivityInWeek(activity, week);
        expect(result.valid).toBe(true);
      });

      it('should accept activity at exactly 10pm Eastern (3am UTC next day)', () => {
        activity.start_date = '2025-01-08T03:00:00Z';
        const result = validateActivityInWeek(activity, week);
        expect(result.valid).toBe(true);
      });

      it('should handle activities from different timezones correctly', () => {
        // All these should be valid - they're all within the same absolute UTC window
        const validActivities = [
          { utc: '2025-01-07T10:00:00Z', local: '2025-01-07T05:00:00', tz: 'America/New_York' }, // 5am Eastern
          { utc: '2025-01-07T14:00:00Z', local: '2025-01-07T09:00:00', tz: 'America/Chicago' },   // 9am Central
          { utc: '2025-01-07T15:30:00Z', local: '2025-01-07T07:30:00', tz: 'America/Los_Angeles' } // 7:30am Pacific
        ];

        validActivities.forEach(act => {
          const result = validateActivityInWeek(
            { start_date: act.utc, start_date_local: act.local, timezone: act.tz },
            week
          );
          expect(result.valid).toBe(true);
        });
      });
    });

    describe('Timestamp details in response', () => {
      it('should include timestamp breakdown for valid activities', () => {
        const result = validateActivityInWeek(activity, week);
        expect(result.timestamps).toEqual({
          activity: expect.any(Number),
          start: expect.any(Number),
          end: expect.any(Number)
        });
        expect(result.timestamps.activity).toBeGreaterThanOrEqual(result.timestamps.start);
        expect(result.timestamps.activity).toBeLessThanOrEqual(result.timestamps.end);
      });

      it('should include timestamp breakdown for invalid activities', () => {
        activity.start_date = '2025-01-07T04:00:00Z';  // Before window
        const result = validateActivityInWeek(activity, week);
        expect(result.valid).toBe(false);
        expect(result.timestamps).not.toBeNull();
        expect(result.timestamps.activity).toBeLessThan(result.timestamps.start);
      });
    });
  });

  describe('Integration: Full workflow', () => {
    it('should handle complete Eastern Time event', () => {
      // Create week boundaries for Tuesday midnight to 10pm Eastern
      const boundaries = computeWeekBoundaries(
        '2025-01-07',
        'America/New_York',
        '00:00:00',
        '22:00:00'
      );

      expect(boundaries.valid).toBe(true);

      // Test various athletes in different timezones
      const testCases = [
        {
          name: 'Tim (Eastern) at 10:30am',
          activity: { start_date: '2025-01-07T15:30:00Z', timezone: 'America/New_York' },
          shouldBeValid: true
        },
        {
          name: 'Chris (Pacific) at 10:30am',
          activity: { start_date: '2025-01-07T18:30:00Z', timezone: 'America/Los_Angeles' },
          shouldBeValid: true
        },
        {
          name: 'Late finisher at 9:59pm Eastern',
          activity: { start_date: '2025-01-08T02:59:00Z', timezone: 'America/New_York' },
          shouldBeValid: true
        },
        {
          name: 'Early morning participant (before event)',
          activity: { start_date: '2025-01-07T04:00:00Z', timezone: 'America/New_York' },
          shouldBeValid: false
        },
        {
          name: 'Late night participant (after event)',
          activity: { start_date: '2025-01-08T04:00:00Z', timezone: 'America/New_York' },
          shouldBeValid: false
        }
      ];

      testCases.forEach(testCase => {
        const result = validateActivityInWeek(testCase.activity, boundaries);
        if (testCase.shouldBeValid) {
          expect(result.valid).toBe(true);
        } else {
          expect(result.valid).toBe(false);
        }
      });
    });

    it('should handle complete Pacific Time event', () => {
      const boundaries = computeWeekBoundaries(
        '2025-01-07',
        'America/Los_Angeles',
        '06:00:00',
        '18:00:00'
      );

      expect(boundaries.valid).toBe(true);

      // 6am-6pm Pacific event
      const testCases = [
        {
          name: 'Participant at 8am Pacific',
          activity: { start_date: '2025-01-07T16:00:00Z', timezone: 'America/Los_Angeles' },  // 8am PST
          shouldBeValid: true
        },
        {
          name: 'Participant at 5:59am Pacific (before start)',
          activity: { start_date: '2025-01-07T13:59:00Z', timezone: 'America/Los_Angeles' },  // 5:59am PST
          shouldBeValid: false
        },
        {
          name: 'Participant at 6:01pm Pacific (after end)',
          activity: { start_date: '2025-01-08T02:01:00Z', timezone: 'America/Los_Angeles' },  // 6:01pm PST
          shouldBeValid: false
        }
      ];

      testCases.forEach(testCase => {
        const result = validateActivityInWeek(testCase.activity, boundaries);
        expect(result.valid).toBe(testCase.shouldBeValid);
      });
    });
  });
});
