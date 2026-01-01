import { Season, Week } from '../types';

const SEASON_GRACE_PERIOD_DAYS = 7;

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
 * 1. Current or most recent past week
 * 2. First upcoming week
 * 3. First week in list (fallback)
 */
export function getDefaultWeek(weeks: Week[], now: number): Week | null {
  if (weeks.length === 0) return null;

  const today = Math.floor(now / 86400) * 86400;

  // Tier 2a: Is there a week happening today or in the past?
  const pastOrCurrentWeek = [...weeks]
    .filter(w => w.start_at <= today)                      // Week started
    .sort((a, b) => b.start_at - a.start_at)[0];          // Most recent
  
  if (pastOrCurrentWeek) return pastOrCurrentWeek;

  // Tier 2b: No past weeks → show the FIRST upcoming week (not the last!)
  const upcomingWeek = [...weeks]
    .filter(w => w.start_at > today)                       // Week in future
    .sort((a, b) => a.start_at - b.start_at)[0];          // Nearest upcoming
  
  return upcomingWeek || weeks[0];                          // Fallback to first week
}
