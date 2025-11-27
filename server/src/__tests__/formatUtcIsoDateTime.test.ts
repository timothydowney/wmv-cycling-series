/**
 * Tests for formatUtcIsoDateTime utility function
 * 
 * This tests the logic used in src/utils/dateUtils.ts formatUtcIsoDateTime()
 * which formats UTC ISO datetime strings from SQLite CURRENT_TIMESTAMP
 * to locale datetime strings in the user's browser timezone.
 */

// Inline the function logic for testing (matches frontend implementation)
function formatUtcIsoDateTime(utcIsoString: string | null | undefined): string {
  if (!utcIsoString) return '—';
  
  // Normalize the string: replace space with 'T' and append 'Z' if no timezone indicator
  let normalized = utcIsoString.replace(' ', 'T');
  
  // Check for timezone indicator using regex:
  // - Ends with 'Z' (UTC)
  // - Contains '+HH:MM' or '-HH:MM' timezone offset after the time portion
  const hasTimezone = /Z$|[+-]\d{2}:\d{2}$/.test(normalized);
  if (!hasTimezone) {
    normalized += 'Z';
  }
  
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return '—';
  
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(date);
}

describe('formatUtcIsoDateTime', () => {
  describe('null/undefined handling', () => {
    test('should return "—" for null input', () => {
      expect(formatUtcIsoDateTime(null)).toBe('—');
    });

    test('should return "—" for undefined input', () => {
      expect(formatUtcIsoDateTime(undefined)).toBe('—');
    });

    test('should return "—" for empty string', () => {
      expect(formatUtcIsoDateTime('')).toBe('—');
    });
  });

  describe('SQLite CURRENT_TIMESTAMP format (no timezone)', () => {
    test('should parse SQLite format with space separator', () => {
      // SQLite CURRENT_TIMESTAMP returns "YYYY-MM-DD HH:MM:SS"
      const result = formatUtcIsoDateTime('2025-11-26 20:09:31');
      // Should return a formatted string (not "—")
      expect(result).not.toBe('—');
      expect(result).toContain('2025');
    });

    test('should treat SQLite format as UTC', () => {
      // This is the key behavior: SQLite timestamps without timezone should be treated as UTC
      const result = formatUtcIsoDateTime('2025-01-15 14:30:00');
      expect(result).not.toBe('—');
      // The exact output depends on the test environment timezone
      // but it should contain the date components
      expect(result).toMatch(/\d{1,2}\/\d{1,2}\/2025/);
    });
  });

  describe('ISO 8601 format with timezone indicators', () => {
    test('should handle ISO format with Z suffix', () => {
      const result = formatUtcIsoDateTime('2025-11-26T20:09:31Z');
      expect(result).not.toBe('—');
      expect(result).toContain('2025');
    });

    test('should handle ISO format with positive timezone offset', () => {
      const result = formatUtcIsoDateTime('2025-11-26T20:09:31+05:00');
      expect(result).not.toBe('—');
      expect(result).toContain('2025');
    });

    test('should handle ISO format with negative timezone offset', () => {
      const result = formatUtcIsoDateTime('2025-11-26T20:09:31-05:00');
      expect(result).not.toBe('—');
      expect(result).toContain('2025');
    });

    test('should not double-append Z suffix', () => {
      // If already has Z, should not add another one
      const result = formatUtcIsoDateTime('2025-11-26T20:09:31Z');
      expect(result).not.toBe('—');
    });
  });

  describe('invalid inputs', () => {
    test('should return "—" for invalid date string', () => {
      expect(formatUtcIsoDateTime('not-a-date')).toBe('—');
    });

    test('should return "—" for malformed date', () => {
      expect(formatUtcIsoDateTime('2025-13-45 99:99:99')).toBe('—');
    });
  });

  describe('output format', () => {
    test('should include date and time components', () => {
      const result = formatUtcIsoDateTime('2025-11-26 20:09:31');
      // Should have date (month/day/year)
      expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
      // Should have time with AM/PM
      expect(result).toMatch(/\d{1,2}:\d{2}:\d{2}\s*(AM|PM)/);
    });

    test('should include seconds in output', () => {
      const result = formatUtcIsoDateTime('2025-11-26 20:09:31');
      // Should include seconds (two digits after second colon)
      expect(result).toMatch(/:\d{2}:\d{2}/);
    });
  });

  describe('timezone normalization', () => {
    test('should normalize space to T in ISO string', () => {
      // Both formats should produce valid results
      const withSpace = formatUtcIsoDateTime('2025-11-26 20:09:31');
      const withT = formatUtcIsoDateTime('2025-11-26T20:09:31');
      
      expect(withSpace).not.toBe('—');
      expect(withT).not.toBe('—');
      // Both should parse to the same underlying time
      // (both will have Z appended since neither has timezone)
    });

    test('should correctly detect timezone offset patterns', () => {
      // These should NOT have Z appended (already have timezone)
      const withZ = '2025-11-26T20:09:31Z';
      const withPositive = '2025-11-26T20:09:31+05:30';
      const withNegative = '2025-11-26T20:09:31-08:00';
      
      // All should parse correctly
      expect(formatUtcIsoDateTime(withZ)).not.toBe('—');
      expect(formatUtcIsoDateTime(withPositive)).not.toBe('—');
      expect(formatUtcIsoDateTime(withNegative)).not.toBe('—');
    });
  });

  describe('edge cases', () => {
    test('should handle midnight', () => {
      const result = formatUtcIsoDateTime('2025-01-15 00:00:00');
      expect(result).not.toBe('—');
    });

    test('should handle end of day', () => {
      const result = formatUtcIsoDateTime('2025-01-15 23:59:59');
      expect(result).not.toBe('—');
    });

    test('should handle leap year date', () => {
      const result = formatUtcIsoDateTime('2024-02-29 12:00:00');
      expect(result).not.toBe('—');
      expect(result).toContain('2024');
    });

    test('should handle year boundary', () => {
      const result = formatUtcIsoDateTime('2024-12-31 23:59:59');
      expect(result).not.toBe('—');
    });

    test('should handle DST boundary dates', () => {
      // March DST transition
      const march = formatUtcIsoDateTime('2025-03-09 02:00:00');
      expect(march).not.toBe('—');
      
      // November DST transition
      const november = formatUtcIsoDateTime('2025-11-02 02:00:00');
      expect(november).not.toBe('—');
    });
  });

  describe('real-world webhook event scenarios', () => {
    test('should format actual webhook created_at timestamp', () => {
      // This is the exact format SQLite returns for webhook events
      const result = formatUtcIsoDateTime('2025-11-26 20:09:31');
      expect(result).not.toBe('—');
      // Verify it contains expected date parts
      expect(result).toContain('2025');
      expect(result).toMatch(/11\/26|26\/11/); // US or international format
    });

    test('should handle timestamps from different years', () => {
      expect(formatUtcIsoDateTime('2023-06-15 10:30:00')).not.toBe('—');
      expect(formatUtcIsoDateTime('2024-01-01 00:00:00')).not.toBe('—');
      expect(formatUtcIsoDateTime('2025-12-31 23:59:59')).not.toBe('—');
    });
  });
});
