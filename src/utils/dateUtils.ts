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
