export const ALL_TIME_RANGE_SECONDS = 999999999;
export const DEFAULT_TIME_RANGE_SECONDS = 604800;

export function getSinceTimestamp(
  sinceSeconds: number,
  nowUnixSeconds = Math.floor(Date.now() / 1000)
): number {
  if (sinceSeconds === ALL_TIME_RANGE_SECONDS) {
    return 0;
  }

  return Math.max(0, nowUnixSeconds - sinceSeconds);
}