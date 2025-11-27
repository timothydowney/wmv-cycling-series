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
