/**
 * StravaProfileService.ts
 * Fetches profile pictures from Strava's authenticated API
 * 
 * Authentication required - uses each participant's own OAuth token
 * This is safe because we're fetching public profile data that users can already see
 * Caches results to avoid excessive API calls
 */

import { Database } from 'better-sqlite3';
import { decryptToken } from '../encryption';

interface AthleteProfile {
  id: number;
  profile: string;
  profile_medium: string;
  profile_large: string;
  firstname: string;
  lastname: string;
}

// Simple in-memory cache to avoid fetching the same athlete multiple times
// Cache expires after 1 hour
const profileCache = new Map<number, { data: AthleteProfile; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

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
      return cached.data.profile || null;
    }

    // Fetch from Strava API with authentication
    const response = await fetch(`https://www.strava.com/api/v3/athletes/${athleteId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.warn(`Failed to fetch Strava profile for athlete ${athleteId}: ${response.status}`);
      return null;
    }

    const profile = await response.json() as AthleteProfile;
    
    // Cache the result
    profileCache.set(athleteId, {
      data: profile,
      timestamp: Date.now()
    });

    return profile.profile || null;
  } catch (error) {
    console.warn(`Error fetching Strava profile for athlete ${athleteId}:`, error);
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
  db: Database
): Promise<Map<number, string | null>> {
  const results = new Map<number, string | null>();
  
  // Filter out athletes already in cache
  const uncachedIds = athleteIds.filter(id => {
    const cached = profileCache.get(id);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      results.set(id, cached.data.profile || null);
      return false;
    }
    return true;
  });

  if (uncachedIds.length === 0) {
    return results;
  }

  // Build a map of athlete ID to their token
  // This way we use each athlete's own token when available
  const athleteTokens = new Map<number, string>();
  
  for (const athleteId of uncachedIds) {
    // Try to get this specific athlete's token
    const athleteToken = db.prepare(
      'SELECT access_token FROM participant_token WHERE strava_athlete_id = ? LIMIT 1'
    ).get(athleteId) as { access_token: string } | undefined;
    
    if (athleteToken) {
      try {
        athleteTokens.set(athleteId, decryptToken(athleteToken.access_token));
      } catch (error) {
        console.warn(`Failed to decrypt token for athlete ${athleteId}:`, error);
      }
    }
  }

  // If we don't have any athlete tokens, fall back to any available token
  let fallbackToken: string | null = null;
  if (athleteTokens.size === 0) {
    const anyToken = db.prepare(
      'SELECT access_token FROM participant_token LIMIT 1'
    ).get() as { access_token: string } | undefined;
    
    if (anyToken) {
      try {
        fallbackToken = decryptToken(anyToken.access_token);
      } catch (error) {
        console.warn('Failed to decrypt fallback token:', error);
      }
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
