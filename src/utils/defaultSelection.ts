import { Season, Week } from '../types';

const SEASON_GRACE_PERIOD_DAYS = 7;
const WEEK_ACTIVE_BUFFER_SECONDS = 24 * 3600; // 24 hours after end_at, week stays "active"

/**
 * Determines if a week is currently "active" (ongoing or recently completed).
 * A week is active if:
 * - It has started AND
 * - It ended less than 24 hours ago
 */
export function isWeekActive(week: Week, now: number): boolean {
  const weekEndWithBuffer = week.end_at + WEEK_ACTIVE_BUFFER_SECONDS;
  return week.start_at <= now && now <= weekEndWithBuffer;
}

/**
 * Determines if a week is in the future (not yet started).
 */
export function isWeekFuture(week: Week, now: number): boolean {
  return week.start_at > now;
}

/**
 * Determines if a week is in the past (ended more than 24 hours ago).
 */
export function isWeekPast(week: Week, now: number): boolean {
  const weekEndWithBuffer = week.end_at + WEEK_ACTIVE_BUFFER_SECONDS;
  return weekEndWithBuffer < now;
}

/**
 * Determines the default season to display based on current time.
 * Priority:
 * 1. Active season (current time is within start/end)
 * 2. Recently closed season (within grace period)
 * 3. Next upcoming season
 * 4. Most recent past season (fallback)
 */
export function getDefaultSeason(seasons: Season[], now: number): Season | null {
  if (!seasons.length) return null;

  // Tier 1a: Is there an active season right now?
  const activeSeason = seasons.find(s => s.start_at <= now && now <= s.end_at);
  if (activeSeason) return activeSeason;

  // Tier 1b: Is there a recently-closed season (within grace period)?
  const pastSeasons = seasons
    .filter(s => s.end_at < now)
    .sort((a, b) => b.end_at - a.end_at); // Descending by end date (most recent first)
    
  const recentlyClosedSeason = pastSeasons[0];
  
  if (recentlyClosedSeason) {
    const daysSinceEnd = (now - recentlyClosedSeason.end_at) / 86400;
    if (daysSinceEnd <= SEASON_GRACE_PERIOD_DAYS) {
      return recentlyClosedSeason;
    }
  }

  // Tier 1c: Default to the next upcoming season
  const upcomingSeasons = seasons
    .filter(s => s.start_at > now)
    .sort((a, b) => a.start_at - b.start_at); // Ascending by start date (nearest first)
  
  const upcomingSeason = upcomingSeasons[0];
  
  if (upcomingSeason) return upcomingSeason;

  // Fallback: If no upcoming seasons, show the most recent past season (even if outside grace period)
  return recentlyClosedSeason || seasons[0];
}

/**
 * Determines the default week to display based on current time.
 * Priority:
 * 1. Most recently started week (shows results of recent/ongoing event)
 * 2. First upcoming week (if no weeks have started yet)
 * 3. First week in list (fallback)
 */
export function getDefaultWeek(weeks: Week[], now: number): Week | null {
  if (weeks.length === 0) return null;

  // Tier 2a: Find the most recently started week
  const mostRecentStarted = weeks
    .filter(w => w.start_at <= now)
    .sort((a, b) => b.start_at - a.start_at)[0];
  
  if (mostRecentStarted) return mostRecentStarted;

  // Tier 2b: No started weeks yet → show the FIRST upcoming week
  const upcomingWeek = weeks
    .filter(w => w.start_at > now)
    .sort((a, b) => a.start_at - b.start_at)[0];
  
  return upcomingWeek || weeks[0];
}
