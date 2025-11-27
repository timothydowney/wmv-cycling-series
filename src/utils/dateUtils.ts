/**
 * Frontend Date Utilities
 * 
 * Converts Unix timestamps (from API) to display strings.
 * Uses browser's Intl API for timezone-aware display (no libraries needed).
 */

/**
 * Convert date input (YYYY-MM-DD) to Unix timestamp for start of day in user's local timezone
 * @param dateStr Date string in format YYYY-MM-DD
 * @returns Unix timestamp in seconds for 00:00:00 in user's local timezone
 */
export function dateToUnixStart(dateStr: string): number {
  const date = new Date(`${dateStr}T00:00:00`);  // No Z - uses browser's local timezone
  return Math.floor(date.getTime() / 1000);
}

/**
 * Convert date input (YYYY-MM-DD) to Unix timestamp for end of day in user's local timezone
 * @param dateStr Date string in format YYYY-MM-DD
 * @returns Unix timestamp in seconds for 23:59:59 in user's local timezone
 */
export function dateToUnixEnd(dateStr: string): number {
  const date = new Date(`${dateStr}T23:59:59`);  // No Z - uses browser's local timezone
  return Math.floor(date.getTime() / 1000);
}

/**
 * Convert Unix timestamp to date string (YYYY-MM-DD) in user's local timezone
 * @param unixSeconds Unix timestamp in seconds
 * @returns Date string in format YYYY-MM-DD
 */
export function unixToDateLocal(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Convert datetime-local input format to Unix timestamp (seconds)
 * @param datetimeLocalStr datetime-local format string (YYYY-MM-DDTHH:MM)
 * @returns Unix timestamp in seconds (UTC)
 */
export function datetimeLocalToUnix(datetimeLocalStr: string): number {
  const date = new Date(datetimeLocalStr);
  return Math.floor(date.getTime() / 1000);
}

/**
 * Convert Unix timestamp (seconds) to datetime-local input format
 * @param unixSeconds Unix timestamp in seconds (UTC)
 * @returns datetime-local format string (YYYY-MM-DDTHH:MM)
 */
export function unixToDatetimeLocal(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Convert Unix timestamp (UTC seconds) to locale date string
 * @param unixSeconds Unix timestamp in seconds (UTC)
 * @param options Intl.DateTimeFormat options
 * @returns Formatted date string in user's local timezone
 */
export function formatUnixDate(
  unixSeconds: number | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!unixSeconds) return 'TBD';
  
  const date = new Date(unixSeconds * 1000);
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options
  };
  
  return new Intl.DateTimeFormat('en-US', defaultOptions).format(date);
}

/**
 * Convert Unix timestamp (UTC seconds) to locale time string
 * @param unixSeconds Unix timestamp in seconds (UTC)
 * @returns Formatted time string (e.g., "2:30 PM")
 */
export function formatUnixTime(
  unixSeconds: number | null | undefined
): string {
  if (!unixSeconds) return '—';
  
  const date = new Date(unixSeconds * 1000);
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);
}

/**
 * Convert Unix timestamp to short date string (e.g., "Nov 15, 2025")
 * @param unixSeconds Unix timestamp in seconds (UTC)
 * @returns Short formatted date
 */
export function formatUnixDateShort(
  unixSeconds: number | null | undefined
): string {
  if (!unixSeconds) return 'TBD';
  
  const date = new Date(unixSeconds * 1000);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
}

/**
 * Format a UTC ISO datetime string (from SQLite CURRENT_TIMESTAMP) to locale datetime string
 * SQLite stores UTC timestamps as "YYYY-MM-DD HH:MM:SS" without timezone indicator.
 * This function ensures the timestamp is parsed as UTC and formatted in user's local timezone.
 * @param utcIsoString UTC datetime string (e.g., "2025-11-26 20:09:31" or "2025-11-26T20:09:31Z")
 * @returns Formatted datetime string in user's local timezone (e.g., "11/26/2025, 3:09:31 PM")
 */
export function formatUtcIsoDateTime(
  utcIsoString: string | null | undefined
): string {
  if (!utcIsoString) return '—';
  
  // Normalize the string: replace space with 'T' and append 'Z' if no timezone indicator
  let normalized = utcIsoString.replace(' ', 'T');
  if (!normalized.endsWith('Z') && !normalized.includes('+') && !normalized.includes('-', 10)) {
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
