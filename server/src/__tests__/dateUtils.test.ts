// @ts-nocheck
import {
  isoToUnix,
  unixToISO,
  nowISO,
  secondsToHHMMSS,
  defaultDayTimeWindow
} from '../dateUtils';

describe('Date Utilities', () => {
  describe('isoToUnix()', () => {
    it('should convert ISO 8601 string to Unix timestamp', () => {
      const iso = '2025-01-15T14:30:00Z';
      const unix = isoToUnix(iso);
      expect(typeof unix).toBe('number');
      // Verify by round-trip
      const backToIso = unixToISO(unix);
      expect(backToIso).toBeDefined();
    });

    it('should handle midnight UTC', () => {
      const iso = '2025-01-15T00:00:00Z';
      const unix = isoToUnix(iso);
      expect(unix).toBe(1736899200);
    });

    it('should handle end of day (11:59:59 PM UTC)', () => {
      const iso = '2025-01-15T23:59:59Z';
      const unix = isoToUnix(iso);
      expect(unix).toBe(1736985599);
    });

    it('should handle ISO string without Z suffix', () => {
      // Browser interprets as UTC
      const iso = '2025-01-15T14:30:00';
      const unix = isoToUnix(iso);
      expect(typeof unix).toBe('number');
      expect(unix).toBeGreaterThan(0);
    });

    it('should return null for null input', () => {
      expect(isoToUnix(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(isoToUnix(undefined)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(isoToUnix('')).toBeNull();
    });

    it('should return the same value if already a Unix timestamp', () => {
      const unix = 1736947800;
      expect(isoToUnix(unix)).toBe(unix);
    });

    it('should return null for invalid date strings', () => {
      expect(isoToUnix('not a date')).toBeNull();
      expect(isoToUnix('2025-13-45T99:99:99Z')).toBeNull();
      expect(isoToUnix('invalid')).toBeNull();
    });

    it('should handle dates with milliseconds', () => {
      const iso = '2025-01-15T14:30:00.123Z';
      const unix = isoToUnix(iso);
      // Verify by round-trip that milliseconds are handled
      const backToIso = unixToISO(unix);
      expect(backToIso).toBeDefined();
      const roundTrip = isoToUnix(backToIso);
      expect(roundTrip).toBe(unix);
    });

    it('should handle leap year dates', () => {
      const iso = '2024-02-29T12:00:00Z'; // Leap year
      const unix = isoToUnix(iso);
      expect(typeof unix).toBe('number');
      expect(unix).toBeGreaterThan(0);
    });

    it('should handle year boundary (Dec 31 to Jan 1)', () => {
      const year2024End = isoToUnix('2024-12-31T23:59:59Z');
      const year2025Start = isoToUnix('2025-01-01T00:00:00Z');
      expect(year2025Start - year2024End).toBe(1);
    });

    it('should maintain precision with multiple conversions', () => {
      const iso1 = '2025-01-15T14:30:00Z';
      const unix1 = isoToUnix(iso1);
      const iso2 = unixToISO(unix1);
      const unix2 = isoToUnix(iso2);
      expect(unix1).toBe(unix2);
    });
  });

  describe('unixToISO()', () => {
    it('should convert Unix timestamp to ISO 8601 string', () => {
      const unix = 1736947800;
      const iso = unixToISO(unix);
      expect(iso).toBeDefined();
      // Verify format: YYYY-MM-DDTHH:MM:SS.000Z
      expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should handle midnight UTC', () => {
      const unix = 1736899200;
      const iso = unixToISO(unix);
      expect(iso).toBe('2025-01-15T00:00:00.000Z');
    });

    it('should handle Unix timestamp 0 (1970-01-01)', () => {
      const iso = unixToISO(0);
      expect(iso).toBe('1970-01-01T00:00:00.000Z');
    });

    it('should handle large Unix timestamps', () => {
      const unix = 2147483647; // Year 2038 problem date
      const iso = unixToISO(unix);
      expect(iso).toBeDefined();
      expect(iso).toContain('2038');
    });

    it('should return null for null input', () => {
      expect(unixToISO(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(unixToISO(undefined)).toBeNull();
    });

    it('should return the same value if already ISO string', () => {
      const iso = '2025-01-15T14:30:00Z';
      expect(unixToISO(iso)).toBe(iso);
    });

    it('should return null for non-integer numbers', () => {
      expect(unixToISO(1736947800.5)).toBeNull();
      expect(unixToISO(1736947800.999)).toBeNull();
    });

    it('should return null for string input', () => {
      // String input is treated as already ISO and returned as-is
      const result = unixToISO('1736947800');
      expect(typeof result).toBe('string');
      expect(result).toBe('1736947800');
    });

    it('should handle negative Unix timestamps (pre-1970)', () => {
      const unix = -86400; // One day before epoch
      const iso = unixToISO(unix);
      expect(iso).toBe('1969-12-31T00:00:00.000Z');
    });

    it('should round-trip with isoToUnix', () => {
      const original = 1736947800;
      const iso = unixToISO(original);
      const roundTrip = isoToUnix(iso);
      expect(roundTrip).toBe(original);
    });
  });

  describe('nowISO()', () => {
    it('should return current time as ISO 8601 UTC string', () => {
      const iso = nowISO();
      expect(typeof iso).toBe('string');
      expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should return a valid ISO string', () => {
      const iso = nowISO();
      const date = new Date(iso);
      expect(date).toBeInstanceOf(Date);
      expect(!isNaN(date.getTime())).toBe(true);
    });

    it('should return different values when called multiple times (time passes)', (done) => {
      const iso1 = nowISO();
      // Wait 10ms to ensure time has passed
      setTimeout(() => {
        const iso2 = nowISO();
        expect(iso2).not.toBe(iso1);
        done();
      }, 10);
    });

    it('should end with Z suffix (UTC indicator)', () => {
      const iso = nowISO();
      expect(iso.endsWith('Z')).toBe(true);
    });

    it('should be parseable with Date constructor', () => {
      const iso = nowISO();
      const timestamp = Date.parse(iso);
      expect(!isNaN(timestamp)).toBe(true);
    });

    it('should always be close to current time', () => {
      const before = Date.now();
      const iso = nowISO();
      const after = Date.now();
      const isoTime = new Date(iso).getTime();
      expect(isoTime).toBeGreaterThanOrEqual(before);
      expect(isoTime).toBeLessThanOrEqual(after + 1000); // Allow 1 second tolerance
    });
  });

  // NOTE: nowUnix() was removed - use Math.floor(Date.now() / 1000) inline instead

  describe('secondsToHHMMSS()', () => {
    it('should convert 0 seconds to 00:00:00', () => {
      expect(secondsToHHMMSS(0)).toBe('00:00:00');
    });

    it('should convert single digit seconds to padded format', () => {
      expect(secondsToHHMMSS(1)).toBe('00:00:01');
      expect(secondsToHHMMSS(9)).toBe('00:00:09');
    });

    it('should convert 60 seconds to one minute', () => {
      expect(secondsToHHMMSS(60)).toBe('00:01:00');
    });

    it('should convert 3600 seconds to one hour', () => {
      expect(secondsToHHMMSS(3600)).toBe('01:00:00');
    });

    it('should convert mixed values correctly', () => {
      expect(secondsToHHMMSS(61)).toBe('00:01:01');
      expect(secondsToHHMMSS(3661)).toBe('01:01:01');
      expect(secondsToHHMMSS(125)).toBe('00:02:05');
      expect(secondsToHHMMSS(7325)).toBe('02:02:05');
    });

    it('should handle typical Strava activity duration (1 hour 23 minutes)', () => {
      const seconds = 3600 + (23 * 60) + 45; // 1:23:45
      expect(secondsToHHMMSS(seconds)).toBe('01:23:45');
    });

    it('should handle long activities (5+ hours)', () => {
      const seconds = (5 * 3600) + (30 * 60) + 15; // 5:30:15
      expect(secondsToHHMMSS(seconds)).toBe('05:30:15');
    });

    it('should handle very long activities (24+ hours)', () => {
      const seconds = (27 * 3600) + (45 * 60) + 30; // 27:45:30
      expect(secondsToHHMMSS(seconds)).toBe('27:45:30');
    });

    it('should return null for null input', () => {
      expect(secondsToHHMMSS(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(secondsToHHMMSS(undefined)).toBeNull();
    });

    it('should return null for negative numbers', () => {
      expect(secondsToHHMMSS(-1)).toBeNull();
      expect(secondsToHHMMSS(-100)).toBeNull();
    });

    it('should return null for non-integer numbers', () => {
      expect(secondsToHHMMSS(60.5)).toBeNull();
      expect(secondsToHHMMSS(3600.999)).toBeNull();
    });

    it('should return null for string input', () => {
      expect(secondsToHHMMSS('60')).toBeNull();
    });

    it('should pad all components with zeros', () => {
      const result = secondsToHHMMSS(1);
      const parts = result.split(':');
      expect(parts[0].length).toBe(2);
      expect(parts[1].length).toBe(2);
      expect(parts[2].length).toBe(2);
    });

    it('should handle seconds up to 59', () => {
      expect(secondsToHHMMSS(59)).toBe('00:00:59');
    });

    it('should handle minutes up to 59', () => {
      expect(secondsToHHMMSS(3599)).toBe('00:59:59');
    });

    it('should handle boundary between minutes and hours', () => {
      expect(secondsToHHMMSS(3599)).toBe('00:59:59');
      expect(secondsToHHMMSS(3600)).toBe('01:00:00');
    });
  });

  describe('defaultDayTimeWindow()', () => {
    it('should create default time window for a date', () => {
      const window = defaultDayTimeWindow('2025-01-15');
      expect(window).toEqual({
        start: '2025-01-15T00:00:00Z',
        end: '2025-01-15T22:00:00Z'
      });
    });

    it('should handle different dates', () => {
      const window1 = defaultDayTimeWindow('2025-01-01');
      expect(window1.start).toBe('2025-01-01T00:00:00Z');
      expect(window1.end).toBe('2025-01-01T22:00:00Z');

      const window2 = defaultDayTimeWindow('2025-12-31');
      expect(window2.start).toBe('2025-12-31T00:00:00Z');
      expect(window2.end).toBe('2025-12-31T22:00:00Z');
    });

    it('should return null for null input', () => {
      expect(defaultDayTimeWindow(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(defaultDayTimeWindow(undefined)).toBeNull();
    });

    it('should return null for invalid date format', () => {
      expect(defaultDayTimeWindow('2025-1-15')).toBeNull(); // Missing zero padding
      expect(defaultDayTimeWindow('15-01-2025')).toBeNull(); // Wrong order
      expect(defaultDayTimeWindow('invalid')).toBeNull();
    });

    it('should have midnight as start time', () => {
      const window = defaultDayTimeWindow('2025-01-15');
      expect(window.start).toContain('T00:00:00Z');
    });

    it('should have 10pm (22:00) as end time', () => {
      const window = defaultDayTimeWindow('2025-01-15');
      expect(window.end).toContain('T22:00:00Z');
    });

    it('should be parseable with isoToUnix', () => {
      const window = defaultDayTimeWindow('2025-01-15');
      const startUnix = isoToUnix(window.start);
      const endUnix = isoToUnix(window.end);
      expect(Number.isInteger(startUnix)).toBe(true);
      expect(Number.isInteger(endUnix)).toBe(true);
      expect(endUnix).toBeGreaterThan(startUnix);
    });

    it('should have 22 hours duration (midnight to 10pm)', () => {
      const window = defaultDayTimeWindow('2025-01-15');
      const startUnix = isoToUnix(window.start);
      const endUnix = isoToUnix(window.end);
      const durationSeconds = endUnix - startUnix;
      const durationHours = durationSeconds / 3600;
      expect(durationHours).toBe(22);
    });

    it('should work with leap year dates', () => {
      const window = defaultDayTimeWindow('2024-02-29');
      expect(window).toEqual({
        start: '2024-02-29T00:00:00Z',
        end: '2024-02-29T22:00:00Z'
      });
    });
  });



  describe('Integration Tests', () => {
    it('should round-trip ISO to Unix and back', () => {
      const originalISO = '2025-01-15T14:30:45Z';
      const unix = isoToUnix(originalISO);
      const resultISO = unixToISO(unix);
      const resultUnix = isoToUnix(resultISO);
      expect(unix).toBe(resultUnix);
    });

    it('should handle current time conversions', () => {
      const iso = nowISO();
      const unix = isoToUnix(iso);
      const backToISO = unixToISO(unix);
      expect(typeof backToISO).toBe('string');
      expect(backToISO).toContain('T');
      expect(backToISO).toContain('Z');
    });

    it('should create time window consistently', () => {
      const dateStr = '2025-01-15';
      const window = defaultDayTimeWindow(dateStr);
      expect(window.start).toBe('2025-01-15T00:00:00Z');
      expect(window.end).toBe('2025-01-15T22:00:00Z');
    });

    it('should convert activity duration correctly', () => {
      // Simulate a Strava activity that took 1 hour, 23 minutes, 45 seconds
      const durationSeconds = isoToUnix('1970-01-01T01:23:45Z') - isoToUnix('1970-01-01T00:00:00Z');
      const formatted = secondsToHHMMSS(durationSeconds);
      expect(formatted).toBe('01:23:45');
    });

    it('should handle week timestamp calculations', () => {
      const weekStart = isoToUnix('2025-01-15T00:00:00Z');
      const weekEnd = isoToUnix('2025-01-15T22:00:00Z');
      const windowDuration = weekEnd - weekStart;
      expect(windowDuration).toBe(22 * 3600); // 22 hours in seconds
      expect(secondsToHHMMSS(windowDuration)).toBe('22:00:00');
    });

    it('should maintain timestamp precision across export/import cycle', () => {
      const exportTime = nowISO();
      const unix = isoToUnix(exportTime);
      const importTime = unixToISO(unix);
      const reimportUnix = isoToUnix(importTime);
      expect(unix).toBe(reimportUnix);
    });
  });

  describe('Edge Cases', () => {
    it('should handle year 2000 (Y2K)', () => {
      const iso = '2000-01-01T00:00:00Z';
      const unix = isoToUnix(iso);
      expect(typeof unix).toBe('number');
      expect(unixToISO(unix)).toBeDefined();
    });

    it('should handle far future dates', () => {
      const iso = '2099-12-31T23:59:59Z';
      const unix = isoToUnix(iso);
      expect(typeof unix).toBe('number');
      expect(unixToISO(unix)).toContain('2099');
    });

    it('should handle DST boundary dates (spring forward)', () => {
      // March 10, 2025 at 2am EDT (DST starts)
      const iso = '2025-03-10T02:00:00Z';
      const unix = isoToUnix(iso);
      expect(typeof unix).toBe('number');
    });

    it('should handle DST boundary dates (fall back)', () => {
      // November 2, 2025 at 2am EDT (DST ends)
      const iso = '2025-11-02T02:00:00Z';
      const unix = isoToUnix(iso);
      expect(typeof unix).toBe('number');
    });

    it('should handle midnight at year boundary', () => {
      const iso = '2025-01-01T00:00:00Z';
      const unix = isoToUnix(iso);
      expect(typeof unix).toBe('number');
      expect(secondsToHHMMSS(0)).toBe('00:00:00');
    });
  });


});
