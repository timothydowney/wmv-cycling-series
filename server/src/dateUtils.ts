/**
 * Date Utilities Module
 * 
 * Common, reusable functions for date/time conversions.
 * Provides DRY helpers to avoid repeating Date manipulation patterns throughout the codebase.
 */

/**
 * Convert ISO 8601 datetime string to Unix timestamp (UTC seconds)
 * Replaces: Math.floor(new Date(isoString).getTime() / 1000)
 * 
 * NOTE: Always use Z suffix (UTC indicator) for consistency with Strava API format.
 *       Without Z, the string is parsed as browser/process local timezone, which varies by environment.
 *       Use Z suffix to ensure identical behavior everywhere (dev, prod, tests).
 * 
 * @param isoString - ISO 8601 datetime with Z suffix, Unix timestamp, or Date object
 * @returns Unix timestamp in seconds, or null if invalid
 * 
 * @example
 *   isoToUnix("2025-01-15T14:30:00Z") → 1736947800
 *   isoToUnix("2025-01-15T00:00:00Z") → 1736899200
 */
export function isoToUnix(isoString: string | number | Date | null | undefined): number | null {
  if (!isoString) return null;
  if (typeof isoString === 'number') return isoString; // Already a Unix timestamp
  
  try {
    const ms = (isoString instanceof Date) ? isoString.getTime() : new Date(isoString).getTime();
    if (isNaN(ms)) return null;
    return Math.floor(ms / 1000);
  } catch {
    return null;
  }
}

/**
 * Convert Unix timestamp (UTC seconds) to ISO 8601 UTC string
 * Replaces: new Date(unixSeconds * 1000).toISOString()
 * 
 * @param unixSeconds - Unix timestamp in seconds (UTC)
 * @returns ISO 8601 UTC string (e.g., "2025-01-15T14:30:00Z") or null if invalid
 * 
 * @example
 *   unixToISO(1736947800) → "2025-01-15T14:30:00.000Z"
 *   unixToISO(1736899200) → "2025-01-15T00:00:00.000Z"
 */
export function unixToISO(unixSeconds: number | string | null | undefined): string | null {
  if (unixSeconds === null || unixSeconds === undefined) return null;
  if (typeof unixSeconds === 'string') return unixSeconds; // Already ISO
  if (!Number.isInteger(unixSeconds)) return null;
  
  try {
    return new Date(unixSeconds * 1000).toISOString();
  } catch {
    return null;
  }
}

/**
 * Get current timestamp as ISO 8601 UTC string
 * Replaces: new Date().toISOString()
 * 
 * @returns Current time in ISO 8601 UTC format (e.g., "2025-01-15T14:30:00.123Z")
 * 
 * @example
 *   nowISO() → "2025-01-15T14:30:45.678Z"
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Convert seconds to HH:MM:SS format
 * Useful for displaying durations and elapsed times
 * 
 * @param seconds - Duration in seconds
 * @returns Formatted time string (e.g., "01:23:45") or null if invalid
 * 
 * @example
 *   secondsToHHMMSS(3661) → "01:01:01"
 *   secondsToHHMMSS(125) → "00:02:05"
 *   secondsToHHMMSS(61) → "00:01:01"
 */
export function secondsToHHMMSS(seconds: number | null | undefined): string | null {
  if (!Number.isInteger(seconds) || seconds === null || seconds === undefined || seconds < 0) return null;
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return [hours, minutes, secs]
    .map(val => String(val).padStart(2, '0'))
    .join(':');
}

export interface TimeWindow {
  start: string;
  end: string;
}

/**
 * Build default time window for a date (midnight to 10pm)
 * Common pattern: event day runs from 00:00:00 to 22:00:00
 * 
 * @param dateISO - Date in YYYY-MM-DD format (e.g., "2025-01-15")
 * @returns { start: "2025-01-15T00:00:00Z", end: "2025-01-15T22:00:00Z" } or null if invalid
 * 
 * @example
 *   defaultDayTimeWindow("2025-01-15") → {
 *     start: "2025-01-15T00:00:00Z",
 *     end: "2025-01-15T22:00:00Z"
 *   }
 */
export function defaultDayTimeWindow(dateISO: string | null | undefined): TimeWindow | null {
  const dateMatch = dateISO && dateISO.match(/^\d{4}-\d{2}-\d{2}$/);
  if (!dateMatch) return null;
  
  return {
    start: `${dateISO}T00:00:00Z`,
    end: `${dateISO}T22:00:00Z`
  };
}

/**
 * Ensure a time string ends with Z (UTC indicator)
 * Useful for normalizing timestamps that may have been stringified or transmitted without the Z suffix
 * 
 * @param timeString - Time string potentially missing Z suffix (e.g., "2025-01-15T14:30:00")
 * @returns Time string with Z suffix (e.g., "2025-01-15T14:30:00Z")
 * 
 * @example
 *   normalizeTimeWithZ("2025-01-15T14:30:00") → "2025-01-15T14:30:00Z"
 *   normalizeTimeWithZ("2025-01-15T14:30:00Z") → "2025-01-15T14:30:00Z" (unchanged)
 */
export function normalizeTimeWithZ(timeString: string | null | undefined): string | null | undefined {
  if (!timeString) return timeString;
  if (typeof timeString !== 'string') return timeString;
  // If it doesn't end with Z and has T, add Z
  if (timeString.includes('T') && !timeString.endsWith('Z')) {
    console.warn(`[TIME NORMALIZATION] Adding missing Z suffix to: '${timeString}'`);
    return timeString + 'Z';
  }
  return timeString;
}
