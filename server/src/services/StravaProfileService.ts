/**
 * StravaProfileService.ts
 * Fetches profile pictures from Strava's authenticated API
 * 
 * Authentication required - uses each participant's own OAuth token
 * This is safe because we're fetching public profile data that users can already see
 * Caches results to avoid excessive API calls
 */

import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import strava from 'strava-v3';
import { getValidAccessToken } from '../tokenManager';
import * as stravaClientLib from '../stravaClient';
import { participantToken } from '../db/schema';
import { desc } from 'drizzle-orm';

// Simple in-memory cache to avoid fetching the same athlete multiple times
// Cache expires after 1 hour
interface CachedProfile {
  profile: string | null;
  timestamp: number;
}
const profileCache = new Map<number, CachedProfile>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const PROFILE_FETCH_TIMEOUT_MS = 5000; // 5 second timeout for Strava API calls

/**
 * Wrap a promise with a timeout
 * Rejects with a timeout error if the promise doesn't resolve within the timeout
 * 
 * TODO: Remove this wrapper function once strava-v3 client is upgraded or replaced.
 * The strava-v3 library uses the deprecated `request` package and doesn't support
 * configurable timeouts. This wrapper is a workaround for intermittent Strava API
 * connectivity issues (ETIMEDOUT errors). Once we migrate to a modern HTTP client
 * (e.g., axios, fetch, or an updated Strava SDK), we can set timeouts directly
 * on the client configuration and remove this utility.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMsg: string
): Promise<T> {
  const timeoutPromise = new Promise<T>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`${timeoutMsg} (timeout after ${timeoutMs}ms)`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

/**
 * Fetch athlete profile from Strava API using their own token
 * Each athlete's profile is fetched with their own OAuth credentials
 * 
 * @param athleteId - Strava athlete ID to fetch
 * @param accessToken - OAuth access token (from the athlete being fetched, or any connected athlete)
 * @returns Profile picture URL or null if fetch fails
 */
async function getAthleteProfilePicture(athleteId: number, accessToken: string): Promise<string | null> {
  try {
    // Check cache first
    const cached = profileCache.get(athleteId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.profile;
    }

    // Use strava client library to fetch athlete profile
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = new (strava.client as any)(accessToken);

    // Wrap the API call with a timeout to prevent hanging on slow/unreachable Strava API
    const athleteData = await withTimeout(
      (client.getEndpoint as any)(`athletes/${athleteId}`, { id: athleteId }),
      PROFILE_FETCH_TIMEOUT_MS,
      `Strava profile fetch for athlete ${athleteId}`
    ) as any;

    const profileUrl = (athleteData?.profile as string | null) || null;

    // Cache the result
    profileCache.set(athleteId, {
      profile: profileUrl,
      timestamp: Date.now()
    });

    return profileUrl;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn(
      `[Profile] Failed to fetch profile for athlete ${athleteId}: ${errorMsg}`
    );
    return null;
  }
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
  athleteIds: number[],
  db: BetterSQLite3Database
): Promise<Map<number, string | null>> {
  const results = new Map<number, string | null>();

  // Filter out athletes already in cache
  const uncachedIds = athleteIds.filter(id => {
    const cached = profileCache.get(id);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      results.set(id, cached.profile);
      return false;
    }
    return true;
  });

  if (uncachedIds.length === 0) {
    return results;
  }

  // Build a map of athlete ID to their valid (refreshed) token
  // This way we use each athlete's own token when available, with auto-refresh
  const athleteTokens = new Map<number, string>();

  for (const athleteId of uncachedIds) {
    try {
      // Use getValidAccessToken to ensure token is refreshed if expiring soon
      const validToken = await getValidAccessToken(db, stravaClientLib, athleteId);
      if (validToken) {
        athleteTokens.set(athleteId, validToken);
        console.log(`[Profile] Retrieved and refreshed token for athlete ${athleteId}`);
      } else {
        console.log(`[Profile] No valid token available for athlete ${athleteId}`);
      }
    } catch (error) {
      console.warn(`[Profile] Failed to get valid token for athlete ${athleteId}:`, error);
      // Continue to next athlete instead of failing completely
    }
  }

  // If we don't have any athlete tokens, fall back to any available valid token
  let fallbackToken: string | null = null;
  if (athleteTokens.size === 0) {
    try {
      // Get any participant that has a token and refresh it
      const anyParticipant = db
        .select({ strava_athlete_id: participantToken.strava_athlete_id })
        .from(participantToken)
        .orderBy(desc(participantToken.updated_at))
        .limit(1)
        .get();

      if (anyParticipant) {
        const validToken = await getValidAccessToken(db, stravaClientLib, anyParticipant.strava_athlete_id);
        if (validToken) {
          fallbackToken = validToken;
          console.log('[Profile] Using fallback token (refreshed) for profile fetches');
        }
      }
    } catch (error) {
      console.warn('Failed to get fallback token:', error);
    }
  }

  if (athleteTokens.size === 0 && !fallbackToken) {
    console.warn('No valid Strava tokens available to fetch athlete profiles');
    // Return empty results for all athletes
    uncachedIds.forEach(id => results.set(id, null));
    return results;
  }

  // Fetch uncached profiles in parallel (but rate-limit to avoid overwhelming Strava)
  // Fetch in batches of 5 with small delays between batches
  const batchSize = 5;
  for (let i = 0; i < uncachedIds.length; i += batchSize) {
    const batch = uncachedIds.slice(i, i + batchSize);
    const promises = batch.map(id => {
      // Use the athlete's own token if available, otherwise use fallback
      const token = athleteTokens.get(id) || fallbackToken;
      return getAthleteProfilePicture(id, token!);
    });

    const batchResults = await Promise.all(promises);
    batch.forEach((id, index) => {
      results.set(id, batchResults[index]);
    });

    // Small delay between batches to be respectful to Strava's API
    if (i + batchSize < uncachedIds.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}

/**
 * Clear the profile cache (useful for testing or manual refresh)
 */
function clearProfileCache(): void {
  profileCache.clear();
}

export {
  getAthleteProfilePicture,
  getAthleteProfilePictures,
  clearProfileCache
};
