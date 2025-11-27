/**
 * Tests for formatUtcIsoDateTime utility function
 * 
 * This tests the actual implementation in src/utils/dateUtils.ts
 * which formats UTC ISO datetime strings from SQLite CURRENT_TIMESTAMP
 * to locale datetime strings in the user's browser timezone.
 */

import { formatUtcIsoDateTime } from '../../../src/utils/dateUtils';

describe('formatUtcIsoDateTime', () => {
  test('should return "—" for null/undefined/empty input', () => {
    expect(formatUtcIsoDateTime(null)).toBe('—');
    expect(formatUtcIsoDateTime(undefined)).toBe('—');
    expect(formatUtcIsoDateTime('')).toBe('—');
  });

  test('should parse SQLite CURRENT_TIMESTAMP format and treat as UTC', () => {
    // SQLite CURRENT_TIMESTAMP returns "YYYY-MM-DD HH:MM:SS" in UTC
    const result = formatUtcIsoDateTime('2025-11-26 20:09:31');
    expect(result).not.toBe('—');
    expect(result).toContain('2025');
    expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/); // date format
    expect(result).toMatch(/\d{1,2}:\d{2}:\d{2}\s*(AM|PM)/); // time format with AM/PM
  });

  test('should return "—" for invalid date string', () => {
    expect(formatUtcIsoDateTime('not-a-date')).toBe('—');
  });
});
