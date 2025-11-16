/**
 * Frontend Date Utilities
 * 
 * Converts Unix timestamps (from API) to display strings.
 * Uses browser's Intl API for timezone-aware display (no libraries needed).
 */

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
 * Convert Unix timestamp to time range string
 * @param startUnix Start time in Unix seconds (UTC)
 * @param endUnix End time in Unix seconds (UTC)
 * @returns Time range string (e.g., "12:00 AM – 10:00 PM")
 */
export function formatUnixTimeRange(
  startUnix: number | null | undefined,
  endUnix: number | null | undefined
): string {
  if (!startUnix || !endUnix) return '— —';
  
  const startStr = formatUnixTime(startUnix);
  const endStr = formatUnixTime(endUnix);
  return `${startStr} – ${endStr}`;
}
