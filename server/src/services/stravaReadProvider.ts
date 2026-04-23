import { desc } from 'drizzle-orm';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { getStravaApiMode } from '../config';
import { participantToken } from '../db/schema';
import { getActivity, getAthleteProfile, getLoggedInAthlete } from '../stravaClient';
import * as stravaClientModule from '../stravaClient';
import { getValidAccessToken } from '../tokenManager';
import { fetchWebhookActivity, hasWebhookActivityFixture } from './webhookActivityProvider';

interface CachedProfile {
  profile: string | null;
  timestamp: number;
}

interface AthleteClub {
  id: number;
  resource_state?: number;
  name?: string;
  [key: string]: unknown;
}

interface WebhookActivityDetails {
  activity_id: string;
  name: string;
  type: string;
  distance_m: number;
  moving_time_sec: number;
  elevation_gain_m: number | null;
  start_date_iso: string;
  device_name: string | null;
  segment_effort_count: number;
  visibility: string | null;
}

type WebhookActivityDetailsStatus =
  | 'available'
  | 'private_or_unavailable'
  | 'token_unavailable'
  | 'unavailable'
  | 'deterministic_unavailable';

interface WebhookActivityDetailsResult {
  details: WebhookActivityDetails | null;
  status: WebhookActivityDetailsStatus;
  message: string | null;
  cached: boolean;
}

function mapWebhookActivityDetails(activityData: Awaited<ReturnType<typeof fetchWebhookActivity>>): WebhookActivityDetails {
  return {
    activity_id: String(activityData.id),
    name: activityData.name,
    type: activityData.type || activityData.sport_type || 'Unknown',
    distance_m: activityData.distance ?? 0,
    moving_time_sec: activityData.moving_time ?? 0,
    elevation_gain_m: activityData.elevation_gain ?? activityData.total_elevation_gain ?? null,
    start_date_iso: activityData.start_date,
    device_name: activityData.device_name || null,
    segment_effort_count: activityData.segment_efforts?.length || 0,
    visibility: activityData.visibility || null,
  };
}

const profileCache = new Map<string, CachedProfile>();
const CACHE_TTL_MS = 60 * 60 * 1000;
const webhookActivityDetailsCache = new Map<
  string,
  Omit<WebhookActivityDetailsResult, 'cached'> & { timestamp: number }
>();
const WEBHOOK_ACTIVITY_DETAILS_SUCCESS_TTL_MS = 10 * 60 * 1000;
const WEBHOOK_ACTIVITY_DETAILS_FAILURE_TTL_MS = 60 * 1000;

function getWebhookActivityDetailsCacheKey(athleteId: string, activityId: string): string {
  return `${athleteId}:${activityId}`;
}

function getWebhookActivityDetailsCacheTtl(status: WebhookActivityDetailsStatus): number {
  return status === 'available'
    ? WEBHOOK_ACTIVITY_DETAILS_SUCCESS_TTL_MS
    : WEBHOOK_ACTIVITY_DETAILS_FAILURE_TTL_MS;
}

function getCachedWebhookActivityDetailsResult(
  athleteId: string,
  activityId: string
): WebhookActivityDetailsResult | null {
  const cacheKey = getWebhookActivityDetailsCacheKey(athleteId, activityId);
  const cached = webhookActivityDetailsCache.get(cacheKey);

  if (!cached) {
    return null;
  }

  const ttlMs = getWebhookActivityDetailsCacheTtl(cached.status);
  if (Date.now() - cached.timestamp > ttlMs) {
    webhookActivityDetailsCache.delete(cacheKey);
    return null;
  }

  return {
    details: cached.details,
    status: cached.status,
    message: cached.message,
    cached: true,
  };
}

function setCachedWebhookActivityDetailsResult(
  athleteId: string,
  activityId: string,
  result: Omit<WebhookActivityDetailsResult, 'cached'>
): WebhookActivityDetailsResult {
  webhookActivityDetailsCache.set(getWebhookActivityDetailsCacheKey(athleteId, activityId), {
    ...result,
    timestamp: Date.now(),
  });

  return {
    ...result,
    cached: false,
  };
}

function usesDeterministicStravaReads(): boolean {
  return getStravaApiMode() !== 'live';
}

function getDeterministicProfilePictureUrl(athleteId: string): string {
  const initials = athleteId.slice(-2).padStart(2, '0');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="#f56004"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#ffffff">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function seedProfileCache(athleteId: string, profileUrl: string | null): void {
  if (!athleteId) {
    return;
  }

  profileCache.set(athleteId, {
    profile: profileUrl,
    timestamp: Date.now(),
  });
}

async function getLiveAthleteProfilePicture(
  athleteId: string,
  accessToken: string
): Promise<string | null> {
  try {
    const cached = profileCache.get(athleteId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.profile;
    }

    const athleteData = await getAthleteProfile(athleteId, accessToken);
    const profileUrl = athleteData?.profile || athleteData?.profile_medium || null;

    profileCache.set(athleteId, {
      profile: profileUrl,
      timestamp: Date.now(),
    });

    return profileUrl;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn(`[Profile] Failed to fetch profile for athlete ${athleteId}: ${errorMsg}`);
    return null;
  }
}

async function getAuthStatusProfilePicture(
  athleteId: string,
  db: BetterSQLite3Database
): Promise<string | null> {
  if (usesDeterministicStravaReads()) {
    return getDeterministicProfilePictureUrl(athleteId);
  }

  const accessToken = await getValidAccessToken(db, stravaClientModule, athleteId);
  return getLiveAthleteProfilePicture(athleteId, accessToken);
}

async function getAthleteProfilePictures(
  athleteIds: string[],
  db: BetterSQLite3Database
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();

  if (usesDeterministicStravaReads()) {
    athleteIds.forEach((athleteId) => {
      results.set(athleteId, getDeterministicProfilePictureUrl(athleteId));
    });
    return results;
  }

  const uncachedIds = athleteIds.filter((id) => {
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

  const athleteTokens = new Map<string, string>();

  for (const athleteId of uncachedIds) {
    try {
      const validToken = await getValidAccessToken(db, stravaClientModule, athleteId);
      athleteTokens.set(athleteId, validToken);
    } catch (error) {
      console.warn(`[Profile] Failed to get valid token for athlete ${athleteId}:`, error);
    }
  }

  let fallbackToken: string | null = null;
  if (athleteTokens.size > 0) {
    fallbackToken = athleteTokens.values().next().value ?? null;
  }

  if (!fallbackToken && athleteTokens.size < uncachedIds.length) {
    try {
      const anyParticipant = db
        .select({ strava_athlete_id: participantToken.strava_athlete_id })
        .from(participantToken)
        .orderBy(desc(participantToken.updated_at))
        .limit(1)
        .get();

      if (anyParticipant) {
        fallbackToken = await getValidAccessToken(
          db,
          stravaClientModule,
          anyParticipant.strava_athlete_id
        );
      }
    } catch (error) {
      console.warn('Failed to get fallback token:', error);
    }
  }

  if (athleteTokens.size === 0 && !fallbackToken) {
    uncachedIds.forEach((id) => results.set(id, null));
    return results;
  }

  const batchSize = 5;
  for (let index = 0; index < uncachedIds.length; index += batchSize) {
    const batch = uncachedIds.slice(index, index + batchSize);
    const batchResults = await Promise.all(
      batch.map((id) => {
        const token = athleteTokens.get(id) || fallbackToken;

        if (!token) {
          return null;
        }

        return getLiveAthleteProfilePicture(id, token!);
      })
    );

    batch.forEach((id, batchIndex) => {
      results.set(id, batchResults[batchIndex]);
    });

    if (index + batchSize < uncachedIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
}

async function checkClubMembership(
  db: BetterSQLite3Database,
  athleteId: string,
  clubId: string
): Promise<boolean> {
  if (usesDeterministicStravaReads()) {
    return false;
  }

  try {
    const accessToken = await getValidAccessToken(db, stravaClientModule, athleteId);
    const athlete = await getLoggedInAthlete(accessToken);

    if (!athlete || !Array.isArray(athlete.clubs)) {
      return false;
    }

    const clubIdNum = Number(clubId);
    return athlete.clubs.some((club: AthleteClub) => Number(club.id) === clubIdNum);
  } catch (error) {
    console.error(`[Club] Error checking membership for athlete ${athleteId}:`, error);
    return false;
  }
}

async function getWebhookActivityDetails(
  db: BetterSQLite3Database,
  athleteId: string,
  activityId: string
): Promise<WebhookActivityDetails | null> {
  const result = await getWebhookActivityDetailsResult(db, athleteId, activityId);
  return result.details;
}

async function getWebhookActivityDetailsResult(
  db: BetterSQLite3Database,
  athleteId: string,
  activityId: string
): Promise<WebhookActivityDetailsResult> {
  const cached = getCachedWebhookActivityDetailsResult(athleteId, activityId);
  if (cached) {
    return cached;
  }

  if (hasWebhookActivityFixture(activityId)) {
    const activityData = await fetchWebhookActivity(activityId, 'fixture-token');
    return setCachedWebhookActivityDetailsResult(athleteId, activityId, {
      details: mapWebhookActivityDetails(activityData),
      status: 'available',
      message: null,
    });
  }

  if (usesDeterministicStravaReads()) {
    return setCachedWebhookActivityDetailsResult(athleteId, activityId, {
      details: null,
      status: 'deterministic_unavailable',
      message: 'Activity detail lookup is disabled in deterministic mode.',
    });
  }

  try {
    const token = await getValidAccessToken(db, stravaClientModule, athleteId);
    const activityData = await getActivity(activityId, token);

    return setCachedWebhookActivityDetailsResult(athleteId, activityId, {
      details: mapWebhookActivityDetails(activityData),
      status: 'available',
      message: null,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
      ? Number((error as { statusCode?: unknown }).statusCode)
      : null;
    console.warn(`[WebhookAdmin] Activity fetch from Strava failed: ${errorMessage}`);

    if (errorMessage === 'Activity not found on Strava' || statusCode === 404) {
      return setCachedWebhookActivityDetailsResult(athleteId, activityId, {
        details: null,
        status: 'private_or_unavailable',
        message: 'Activity details are not currently visible on Strava. This usually means the activity is still private.',
      });
    }

    if (
      errorMessage === 'Invalid or expired Strava token'
      || statusCode === 401
      || errorMessage.includes('Participant not connected to Strava')
    ) {
      return setCachedWebhookActivityDetailsResult(athleteId, activityId, {
        details: null,
        status: 'token_unavailable',
        message: 'Activity details could not be fetched because the athlete is not currently connected to Strava.',
      });
    }

    return setCachedWebhookActivityDetailsResult(athleteId, activityId, {
      details: null,
      status: 'unavailable',
      message: 'Activity details could not be fetched from Strava right now.',
    });
  }
}

function clearProfileCache(): void {
  profileCache.clear();
}

function clearWebhookActivityDetailsCache(): void {
  webhookActivityDetailsCache.clear();
}

export {
  checkClubMembership,
  clearProfileCache,
  clearWebhookActivityDetailsCache,
  getAthleteProfilePictures,
  getAuthStatusProfilePicture,
  getDeterministicProfilePictureUrl,
  getLiveAthleteProfilePicture,
  getWebhookActivityDetails,
  getWebhookActivityDetailsResult,
  seedProfileCache,
};
export type { WebhookActivityDetails, WebhookActivityDetailsResult, WebhookActivityDetailsStatus };