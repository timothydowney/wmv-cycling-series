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
 * @param {string} isoString - ISO 8601 datetime with Z suffix (e.g., "2025-01-15T14:30:00Z")
 * @returns {number|null} Unix timestamp in seconds, or null if invalid
 * 
 * @example
 *   isoToUnix("2025-01-15T14:30:00Z") → 1736947800
 *   isoToUnix("2025-01-15T00:00:00Z") → 1736899200
 */
function isoToUnix(isoString) {
  if (!isoString) return null;
  if (typeof isoString === 'number') return isoString; // Already a Unix timestamp
  
  try {
    const ms = new Date(isoString).getTime();
    if (isNaN(ms)) return null;
    return Math.floor(ms / 1000);
  } catch (e) {
    return null;
  }
}

/**
 * Convert Unix timestamp (UTC seconds) to ISO 8601 UTC string
 * Replaces: new Date(unixSeconds * 1000).toISOString()
 * 
 * @param {number} unixSeconds - Unix timestamp in seconds (UTC)
 * @returns {string|null} ISO 8601 UTC string (e.g., "2025-01-15T14:30:00Z") or null if invalid
 * 
 * @example
 *   unixToISO(1736947800) → "2025-01-15T14:30:00.000Z"
 *   unixToISO(1736899200) → "2025-01-15T00:00:00.000Z"
 */
function unixToISO(unixSeconds) {
  if (unixSeconds === null || unixSeconds === undefined) return null;
  if (typeof unixSeconds === 'string') return unixSeconds; // Already ISO
  if (!Number.isInteger(unixSeconds)) return null;
  
  try {
    return new Date(unixSeconds * 1000).toISOString();
  } catch (e) {
    return null;
  }
}

/**
 * Get current timestamp as ISO 8601 UTC string
 * Replaces: new Date().toISOString()
 * 
 * @returns {string} Current time in ISO 8601 UTC format (e.g., "2025-01-15T14:30:00.123Z")
 * 
 * @example
 *   nowISO() → "2025-01-15T14:30:45.678Z"
 */
function nowISO() {
  return new Date().toISOString();
}

/**
 * Convert seconds to HH:MM:SS format
 * Useful for displaying durations and elapsed times
 * 
 * @param {number} seconds - Duration in seconds
 * @returns {string|null} Formatted time string (e.g., "01:23:45") or null if invalid
 * 
 * @example
 *   secondsToHHMMSS(3661) → "01:01:01"
 *   secondsToHHMMSS(125) → "00:02:05"
 *   secondsToHHMMSS(61) → "00:01:01"
 */
function secondsToHHMMSS(seconds) {
  if (!Number.isInteger(seconds) || seconds < 0) return null;
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return [hours, minutes, secs]
    .map(val => String(val).padStart(2, '0'))
    .join(':');
}

/**
 * Build default time window for a date (midnight to 10pm)
 * Common pattern: event day runs from 00:00:00 to 22:00:00
 * 
 * @param {string} dateISO - Date in YYYY-MM-DD format (e.g., "2025-01-15")
 * @returns {Object|null} { start: "2025-01-15T00:00:00Z", end: "2025-01-15T22:00:00Z" } or null if invalid
 * 
 * @example
 *   defaultDayTimeWindow("2025-01-15") → {
 *     start: "2025-01-15T00:00:00Z",
 *     end: "2025-01-15T22:00:00Z"
 *   }
 */
function defaultDayTimeWindow(dateISO) {
  const dateMatch = dateISO && dateISO.match(/^\d{4}-\d{2}-\d{2}$/);
  if (!dateMatch) return null;
  
  return {
    start: `${dateISO}T00:00:00Z`,
    end: `${dateISO}T22:00:00Z`
  };
}

module.exports = {
  isoToUnix,
  unixToISO,
  nowISO,
  secondsToHHMMSS,
  defaultDayTimeWindow
};
