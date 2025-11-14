/**
 * Timezone Management Module
 * 
 * Handles timezone-aware comparisons for activity matching against week boundaries.
 * 
 * Key principle: Use absolute UTC times for all comparisons.
 * - Week boundaries are stored as absolute UTC times (computed from season timezone + week date/time)
 * - Activities have start_date (absolute UTC from Strava) and start_date_local (local time)
 * - Comparison uses start_date (absolute UTC) against week boundaries (absolute UTC)
 * 
 * This avoids all timezone ambiguity by using absolute times as the source of truth.
 */

/**
 * Parse ISO 8601 datetime string to Unix timestamp (seconds)
 * @param {string} isoString - ISO 8601 datetime (e.g., "2018-02-16T14:52:54Z")
 * @returns {number} Unix timestamp in seconds, or null if invalid
 */
function parseISOToUnix(isoString) {
  if (!isoString) return null;
  try {
    const ms = new Date(isoString).getTime();
    if (isNaN(ms)) return null;
    return Math.floor(ms / 1000);
  } catch (e) {
    return null;
  }
}

/**
 * Validate activity falls within week boundaries using absolute UTC times
 * 
 * @param {Object} activity - Strava activity with { start_date, start_date_local, timezone }
 * @param {Object} week - Week definition with { start_time_utc, end_time_utc } (absolute UTC times)
 * @returns {Object} { valid: boolean, message: string, timestamps: { activity, start, end } }
 * 
 * Example:
 *   activity = { start_date: "2025-01-07T13:30:00Z", start_date_local: "2025-01-07T08:30:00Z", timezone: "America/New_York" }
 *   week = { start_time_utc: "2025-01-07T05:00:00Z", end_time_utc: "2025-01-08T03:00:00Z" }
 *   => Returns { valid: true, ... }
 */
function validateActivityInWeek(activity, week) {
  // Extract absolute UTC time from activity (this is the authoritative timestamp)
  const activityTime = parseISOToUnix(activity.start_date);
  if (activityTime === null) {
    return {
      valid: false,
      message: `Invalid activity start_date: ${activity.start_date}`,
      timestamps: null
    };
  }

  // Parse week boundaries (stored as absolute UTC times)
  // Support both naming conventions: start_time_utc (timezone manager output) and start_time (database schema)
  const weekStartStr = week.start_time_utc || week.start_time;
  const weekEndStr = week.end_time_utc || week.end_time;
  
  const weekStart = parseISOToUnix(weekStartStr);
  const weekEnd = parseISOToUnix(weekEndStr);

  if (weekStart === null || weekEnd === null) {
    return {
      valid: false,
      message: `Invalid week boundaries: ${weekStartStr} to ${weekEndStr}`,
      timestamps: null
    };
  }

  // Compare absolute UTC times
  if (activityTime < weekStart) {
    return {
      valid: false,
      message: `Activity ${activity.start_date} (UTC) is before week start ${week.start_time_utc} (UTC)`,
      timestamps: { activity: activityTime, start: weekStart, end: weekEnd }
    };
  }

  if (activityTime > weekEnd) {
    return {
      valid: false,
      message: `Activity ${activity.start_date} (UTC) is after week end ${week.end_time_utc} (UTC)`,
      timestamps: { activity: activityTime, start: weekStart, end: weekEnd }
    };
  }

  return {
    valid: true,
    message: 'Activity within week boundaries',
    timestamps: { activity: activityTime, start: weekStart, end: weekEnd }
  };
}

/**
 * Compute absolute UTC week boundaries from season timezone and week date/time
 * 
 * WMV seasons are always in Eastern Time, but we make this configurable.
 * Given a week date (e.g., "2025-01-07") and time in season timezone (e.g., "00:00:00"),
 * we compute the corresponding absolute UTC times.
 * 
 * @param {string} weekDate - Date in ISO 8601 format (YYYY-MM-DD), e.g., "2025-01-07"
 * @param {string} seasonTimezone - IANA timezone name, e.g., "America/New_York"
 * @param {string} startTimeOfDay - Time of day in season timezone (HH:MM:SS), e.g., "00:00:00"
 * @param {string} endTimeOfDay - Time of day in season timezone (HH:MM:SS), e.g., "22:00:00"
 * @returns {Object} { start_time_utc, end_time_utc, start_unix, end_unix } or null if invalid
 * 
 * Example (Eastern Time):
 *   Input: date="2025-01-07", timezone="America/New_York", start="00:00:00", end="22:00:00"
 *   Output: {
 *     start_time_utc: "2025-01-07T05:00:00Z",  (midnight EST = 5am UTC)
 *     end_time_utc: "2025-01-08T03:00:00Z",    (10pm EST = 3am UTC next day)
 *     start_unix: 1735045200,
 *     end_unix: 1735124400
 *   }
 */
function computeWeekBoundaries(weekDate, seasonTimezone, startTimeOfDay, endTimeOfDay) {
  // Validate inputs
  if (!weekDate || !seasonTimezone || !startTimeOfDay || !endTimeOfDay) {
    return {
      valid: false,
      message: 'Missing required parameters: weekDate, seasonTimezone, startTimeOfDay, endTimeOfDay'
    };
  }

  // Validate date format (YYYY-MM-DD)
  const dateMatch = weekDate.match(/^\d{4}-\d{2}-\d{2}$/);
  if (!dateMatch) {
    return {
      valid: false,
      message: `Invalid date format: ${weekDate} (expected YYYY-MM-DD)`
    };
  }

  // Validate time format (HH:MM:SS)
  const timeMatch = /^\d{2}:\d{2}:\d{2}$/.test(startTimeOfDay) && /^\d{2}:\d{2}:\d{2}$/.test(endTimeOfDay);
  if (!timeMatch) {
    return {
      valid: false,
      message: `Invalid time format (expected HH:MM:SS): ${startTimeOfDay} or ${endTimeOfDay}`
    };
  }

  try {
    // Build ISO 8601 strings in the season timezone
    const startLocalISO = `${weekDate}T${startTimeOfDay}`;
    const endLocalISO = `${weekDate}T${endTimeOfDay}`;

    // For now, we use a simple offset-based calculation
    // In production, use Intl API or date-fns-tz for proper DST handling
    const offsetSeconds = getTimezoneOffsetSeconds(seasonTimezone);
    if (offsetSeconds === null) {
      return {
        valid: false,
        message: `Unknown timezone: ${seasonTimezone}`
      };
    }

    // Parse local times and convert to UTC
    const startLocalMs = new Date(`${startLocalISO}Z`).getTime(); // Parse as UTC first
    const endLocalMs = new Date(`${endLocalISO}Z`).getTime();

    // Adjust by timezone offset to get absolute UTC
    const startUtcMs = startLocalMs - offsetSeconds * 1000;
    const endUtcMs = endLocalMs - offsetSeconds * 1000;

    // Convert to ISO 8601 UTC format
    const startUtcDate = new Date(startUtcMs);
    const endUtcDate = new Date(endUtcMs);

    const startTimeUtc = startUtcDate.toISOString();
    const endTimeUtc = endUtcDate.toISOString();

    return {
      valid: true,
      start_time_utc: startTimeUtc,
      end_time_utc: endTimeUtc,
      start_unix: Math.floor(startUtcMs / 1000),
      end_unix: Math.floor(endUtcMs / 1000),
      message: 'Week boundaries computed successfully'
    };
  } catch (error) {
    return {
      valid: false,
      message: `Error computing week boundaries: ${error.message}`
    };
  }
}

/**
 * Get UTC offset in seconds for a timezone
 * 
 * This is a simplified implementation. In production, use Intl API or date-fns-tz
 * for proper DST handling and all timezones.
 * 
 * @param {string} timezone - IANA timezone name (e.g., "America/New_York")
 * @returns {number|null} Offset in seconds (e.g., -18000 for EST = UTC-5), or null if unknown
 */
function getTimezoneOffsetSeconds(timezone) {
  // Map of common timezones to their offsets (these are standard offsets, DST varies)
  const offsets = {
    'UTC': 0,
    'GMT': 0,
    'America/New_York': -18000,      // EST (UTC-5), EDT (UTC-4)
    'America/Chicago': -21600,       // CST (UTC-6), CDT (UTC-5)
    'America/Denver': -25200,        // MST (UTC-7), MDT (UTC-6)
    'America/Los_Angeles': -28800,   // PST (UTC-8), PDT (UTC-7)
    'Europe/London': 0,              // GMT (UTC+0), BST (UTC+1)
    'Europe/Paris': 3600,            // CET (UTC+1), CEST (UTC+2)
    'Asia/Tokyo': 32400,             // JST (UTC+9)
    'Australia/Sydney': 39600        // AEDT (UTC+11), AEST (UTC+10)
  };

  return offsets[timezone] !== undefined ? offsets[timezone] : null;
}

/**
 * Format Unix timestamp to ISO 8601 UTC string
 * @param {number} unixSeconds - Unix timestamp in seconds
 * @returns {string} ISO 8601 UTC string (e.g., "2025-01-07T05:00:00Z")
 */
function unixToISO(unixSeconds) {
  if (!Number.isInteger(unixSeconds)) return null;
  return new Date(unixSeconds * 1000).toISOString();
}

module.exports = {
  parseISOToUnix,
  validateActivityInWeek,
  computeWeekBoundaries,
  getTimezoneOffsetSeconds,
  unixToISO
};
