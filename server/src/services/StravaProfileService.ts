/**
 * StravaProfileService.ts
 * Fetches profile pictures from Strava's authenticated API
 * 
 * Authentication required - uses each participant's own OAuth token
 * This is safe because we're fetching public profile data that users can already see
 * Caches results to avoid excessive API calls
 */

import type { AppDatabase } from '../db/types';
import {
  clearProfileCache as clearProfileCacheFromProvider,
  getAthleteProfilePictures as getAthleteProfilePicturesFromProvider,
  getAuthStatusProfilePicture as getAuthStatusProfilePictureFromProvider,
  getLiveAthleteProfilePicture,
  seedProfileCache as seedProfileCacheFromProvider,
} from './stravaReadProvider';

/**
 * Seed the profile cache with an already-known profile URL
 * Used during login to save an extra API call
 */
export function seedProfileCache(athleteId: string, profileUrl: string | null): void {
  seedProfileCacheFromProvider(athleteId, profileUrl);
  console.log(`[Profile] Cache seeded for athlete ${athleteId}`);
}

/**
 * Fetch athlete profile from Strava API using their own token
 * Each athlete's profile is fetched with their own OAuth credentials
 * 
 * @param athleteId - Strava athlete ID to fetch
 * @param accessToken - OAuth access token (from the athlete being fetched, or any connected athlete)
 * @returns Profile picture URL or null if fetch fails
 */
async function getAthleteProfilePicture(athleteId: string, accessToken: string): Promise<string | null> {
  return getLiveAthleteProfilePicture(athleteId, accessToken);
}

async function getAuthStatusProfilePicture(
  athleteId: string,
  db: AppDatabase
): Promise<string | null> {
  return getAuthStatusProfilePictureFromProvider(athleteId, db);
}

/**
 * Batch fetch profiles for multiple athletes using the database to get tokens
 * Each athlete's profile is fetched using their own token when available
 * Falls back to using any available token if the athlete's own token isn't available
 * 
 * @param athleteIds - Array of Strava athlete IDs
 * @param db - Database connection to fetch tokens
 * @returns Map of athlete ID to profile picture URL
 */
async function getAthleteProfilePictures(
  athleteIds: string[],
  db: AppDatabase
): Promise<Map<string, string | null>> {
  return getAthleteProfilePicturesFromProvider(athleteIds, db);
}

/**
 * Clear the profile cache (useful for testing or manual refresh)
 */
function clearProfileCache(): void {
  clearProfileCacheFromProvider();
}

export {
  getAuthStatusProfilePicture,
  getAthleteProfilePicture,
  getAthleteProfilePictures,
  clearProfileCache
};
