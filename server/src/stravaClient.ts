/**
 * Strava API Client Module
 *
 * Encapsulates all interactions with the Strava API.
 * Provides a clean, testable interface for:
 * - OAuth token management
 * - Activity fetching and validation
 * - Segment information retrieval
 *
 * This module centralizes error handling and API parameter management
 * to make testing and maintenance easier.
 */

import strava, { 
  RefreshTokenResponse as StravaRefreshTokenResponse,
  DetailedActivityResponse,
  AthleteRouteResponse
} from 'strava-v3';
import { Segment } from './db/schema'; // Import Drizzle Segment type

/**
 * OAuth token data returned by Strava
 */
interface OAuthTokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: Record<string, unknown>;
}

/**
 * Token refresh response (using library type as base)
 */
type RefreshTokenResponse = Pick<StravaRefreshTokenResponse, 'access_token' | 'refresh_token' | 'expires_at'>;

/**
 * Activity data from Strava API
 * Note: We extend the library's DetailedActivityResponse and add segment_efforts 
 * which is missing from the library's type definition.
 */
interface Activity extends DetailedActivityResponse {
  segment_efforts?: SegmentEffort[];
  device_name?: string;
  [key: string]: unknown;
}

/**
 * Segment effort data
 */
interface SegmentEffort {
  id: string;
  segment?: {
    id: string;
    [key: string]: unknown;
  };
  elapsed_time: number;
  start_date: string;
  pr_rank?: number | null;
  [key: string]: unknown;
}

/**
 * Segment data from Strava API
 */
interface StravaApiSegment {
  id: string;
  name: string;
  distance: number;
  average_grade?: number;
  total_elevation_gain?: number;
  climb_category?: number | null;
  city?: string;
  state?: string;
  country?: string;
  [key: string]: unknown;
}

/**
 * Internal interface for the Strava client instance to avoid 'as any' at call sites.
 * The strava-v3 library's own types are currently incomplete for these methods.
 */
interface StravaClientInstance {
  activities: {
    get(args: { id: string; include_all_efforts?: boolean }): Promise<Activity>;
    listAthleteActivities(args: {
      after?: number;
      before?: number;
      page?: number;
      per_page?: number;
    }): Promise<Activity[]>;
  };
  segments: {
    get(args: { id: string }): Promise<StravaApiSegment>;
  };
  athletes: {
    get(args: { athlete_id: string }): Promise<AthleteRouteResponse>;
  };
  athlete: {
    listActivities(args: {
      after?: number;
      before?: number;
      page?: number;
      per_page?: number;
      include_all_efforts?: boolean;
    }): Promise<Activity[]>;
  };
}

/**
 * Helper to create a typed Strava client instance.
 * The strava-v3 library's client() method configures an object with the athletes, activities, etc.
 * We call it on a new object to create a configured client with the given token.
 */
function createStravaClient(accessToken: string): StravaClientInstance {
  const clientObj = {} as any;
  strava.client.call(clientObj, accessToken);
  return clientObj as StravaClientInstance;
}

/**
 * Get athlete profile by ID using the Strava API
 * 
 * While the strava-v3 library's Athletes class only officially exposes stats(),
 * the underlying httpClient supports any endpoint. We access it through the
 * athletes instance to fetch the full /athletes/{id} profile, which includes
 * the profile picture URL. This is better than making a direct axios call because:
 * 1. Uses the library's already-configured HTTP client with auth headers
 * 2. Consistent error handling and timeout behavior
 * 3. Respects the library's rate limiting configuration
 * 
 * @param athleteId - Strava athlete ID to fetch
 * @param accessToken - Valid Strava access token
 * @returns Athlete profile data including profile_medium and profile URLs
 * @throws {Error} If athlete fetch fails
 */
async function getAthleteProfile(athleteId: string, accessToken: string): Promise<any> {
  try {
    const client = createStravaClient(accessToken);
    
    // Access the httpClient through the athletes instance to call /athletes/{id}
    // The httpClient.getEndpoint() method is the foundation of all strava-v3 API calls
    const result = await (client.athletes as any).client.getEndpoint(
      `athletes/${athleteId}`
    );
    
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch athlete profile: ${message}`);
  }
}

/**
 * OAuth: Exchange authorization code for tokens
 * @param code - Authorization code from Strava OAuth flow
 * @returns Token data { access_token, refresh_token, expires_at, athlete }
 * @throws {Error} If token exchange fails
 */
async function exchangeAuthorizationCode(code: string): Promise<OAuthTokenData> {
  try {
    const tokenData = await strava.oauth.getToken(code);

    if (!tokenData || !tokenData.access_token) {
      throw new Error('No access token in OAuth response');
    }

    return {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
      athlete: tokenData.athlete
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`OAuth token exchange failed: ${message}`);
  }
}

/**
 * OAuth: Refresh an expired access token using refresh token
 * @param refreshToken - Refresh token from previous OAuth exchange
 * @returns New token data { access_token, refresh_token, expires_at }
 * @throws {Error} If token refresh fails
 */
async function refreshAccessToken(
  refreshToken: string
): Promise<RefreshTokenResponse> {
  try {
    const newTokenData = await strava.oauth.refreshToken(refreshToken);

    if (!newTokenData || !newTokenData.access_token) {
      throw new Error('No access token in refresh response');
    }

    return {
      access_token: newTokenData.access_token,
      refresh_token: newTokenData.refresh_token,
      expires_at: newTokenData.expires_at
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Token refresh failed: ${message}`);
  }
}

/**
 * Activities: Fetch a single activity by ID
 * @param activityId - Strava activity ID
 * @param accessToken - Valid Strava access token
 * @returns Activity data including segment_efforts
 * @throws {Error} If activity fetch fails
 */
async function getActivity(activityId: string, accessToken: string): Promise<Activity> {
  try {
    console.log(
      `[Strava API] Fetching full activity details for ID: ${activityId}`
    );
    const client = createStravaClient(accessToken);

    const activity = await client.activities.get({
      id: activityId,
      include_all_efforts: true
    });

    if (!activity) {
      throw new Error('No activity data returned');
    }

    const effortCount = activity.segment_efforts
      ? activity.segment_efforts.length
      : 0;
    console.log(
      `[Strava API] ✓ Activity ${activityId} loaded: '${activity.name}', ${effortCount} segment efforts, type: '${activity.type}'`
    );
    return activity;
  } catch (error) {
    const err = error as Record<string, unknown>;
    if (err.statusCode === 404) {
      throw new Error('Activity not found on Strava');
    } else if (err.statusCode === 401) {
      throw new Error('Invalid or expired Strava token');
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch activity: ${message}`);
  }
}

/**
 * Activities: Fetch all activities for authenticated athlete within time window
 * Handles pagination to get ALL activities (not just first page)
 *
 * @param accessToken - Valid Strava access token (athlete's personal token)
 * @param afterTimestamp - Unix timestamp (start of window)
 * @param beforeTimestamp - Unix timestamp (end of window)
 * @param options - Optional configuration
 * @returns All activities within the time window
 * @throws {Error} If activity fetch fails
 */
interface ListActivitiesOptions {
  perPage?: number;
  includeAllEfforts?: boolean;
}

async function listAthleteActivities(
  accessToken: string,
  afterTimestamp: number,
  beforeTimestamp: number,
  options: ListActivitiesOptions = {}
): Promise<Activity[]> {
  try {
    const client = createStravaClient(accessToken);
    const perPage = options.perPage || 100; // Max allowed by Strava
    const includeAllEfforts = options.includeAllEfforts !== false; // Default true

    // Convert timestamps to readable dates for logging
    const afterDate = new Date(afterTimestamp * 1000).toISOString();
    const beforeDate = new Date(beforeTimestamp * 1000).toISOString();
    console.log(
      `[Strava API] listAthleteActivities: fetching activities between ${afterDate} and ${beforeDate}`
    );
    console.log(`  Timestamps: after=${afterTimestamp}, before=${beforeTimestamp}`);
    console.log(
      `  Options: perPage=${perPage}, includeAllEfforts=${includeAllEfforts}`
    );

    let allActivities: Activity[] = [];
    let page = 1;
    let hasMorePages = true;

    // Pagination loop: fetch all pages
    while (hasMorePages) {
      console.log(`[Strava API] Fetching page ${page}...`);
      const activities = await client.athlete.listActivities({
        after: afterTimestamp,
        before: beforeTimestamp,
        per_page: perPage,
        page: page,
        include_all_efforts: includeAllEfforts
      });

      console.log(
        `[Strava API] Page ${page} returned ${activities ? activities.length : 0} activities`
      );

      if (!activities || activities.length === 0) {
        console.log(
          `[Strava API] No more activities on page ${page}, stopping pagination`
        );
        hasMorePages = false;
      } else {
        allActivities = allActivities.concat(activities);
        console.log(`[Strava API] Total activities so far: ${allActivities.length}`);

        // Stop if we got fewer than perPage items (indicates last page)
        if (activities.length < perPage) {
          console.log(
            `[Strava API] Got ${activities.length} activities (< ${perPage}), likely last page`
          );
          hasMorePages = false;
        }

        page++;
      }
    }

    console.log(
      `[Strava API] ✓ Fetch complete: ${allActivities.length} total activities returned`
    );
    return allActivities;
  } catch (error) {
    // Handle AggregateError and other error types
    console.error('[Strava API] Error caught in listAthleteActivities:');
    console.error('  Error type:', error?.constructor?.name);
    console.error('  Full error object:', error);

    let errorMsg = '';

    // Check for Strava API 400 "future" error (event date is in the future)
    if (error instanceof Error && error.message.includes('"code":"future"')) {
      const futureDate = new Date(afterTimestamp * 1000).toLocaleDateString();
      errorMsg = `Event date (${futureDate}) is in the future - activities cannot be fetched before the event occurs`;
    }
    // Check if it's an AggregateError (has errors array)
    else if (error instanceof Error && 'errors' in error) {
      const aggError = error as Error & { errors: any[] };
      console.error(`  AggregateError with ${aggError.errors?.length || 0} sub-errors:`);
      const messages = (aggError.errors || [])
        .map((e: any, idx: number) => {
          console.error(`    [${idx}]`, e);
          return e instanceof Error ? e.message : String(e);
        })
        .join('; ');
      errorMsg = `[AggregateError: ${messages}]`;
    } else if (error instanceof Error) {
      errorMsg = error.message;
    } else {
      errorMsg = String(error);
    }

    throw new Error(`Failed to fetch activities: ${errorMsg}`);
  }
}

/**
 * Segments: Fetch segment details by ID
 * @param segmentId - Strava segment ID
 * @param accessToken - Valid Strava access token
 * @returns Segment data { id, name, distance, average_grade, total_elevation_gain, climb_category, city, state, country }
 * @throws {Error} If segment fetch fails
 */
async function getSegment(
  segmentId: string,
  accessToken: string
): Promise<StravaApiSegment> {
  try {
    const client = createStravaClient(accessToken);

    const segment = await client.segments.get({ id: segmentId });

    if (!segment) {
      throw new Error('No segment data returned');
    }

    // Debug: log full segment response to see all fields
    console.log(`[Strava API] Segment response for ID ${segmentId}:`, {
      id: segment.id,
      name: segment.name,
      distance: segment.distance,
      average_grade: segment.average_grade,
      total_elevation_gain: segment.total_elevation_gain,
      climb_category: segment.climb_category,
      city: segment.city,
      state: segment.state,
      country: segment.country
    });

    return {
      id: segment.id,
      name: segment.name,
      distance: segment.distance,
      average_grade: segment.average_grade,
      total_elevation_gain: segment.total_elevation_gain,
      climb_category: segment.climb_category,
      city: segment.city,
      state: segment.state,
      country: segment.country
    };
  } catch (error) {
    const err = error as Record<string, unknown>;
    if (err.statusCode === 404) {
      throw new Error('Segment not found on Strava');
    } else if (err.statusCode === 401) {
      throw new Error('Invalid or expired Strava token');
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch segment: ${message}`);
  }
}

/**
 * Map Strava API Segment response to SegmentRow database type
 * Converts field names from Strava API format to database format
 * 
 * @param stravaSegment - Segment data from Strava API (with id, not strava_segment_id)
 * @returns Segment data in SegmentRow format (ready for database storage, minus created_at timestamp)
 */
function mapStravaSegmentToSegmentRow(
  stravaSegment: StravaApiSegment
): Omit<Segment, 'created_at'> {
  return {
    strava_segment_id: stravaSegment.id,
    name: stravaSegment.name,
    distance: stravaSegment.distance,
    total_elevation_gain: stravaSegment.total_elevation_gain ?? null,
    average_grade: stravaSegment.average_grade ?? null,
    climb_category: stravaSegment.climb_category ?? null,
    city: stravaSegment.city ?? null,
    state: stravaSegment.state ?? null,
    country: stravaSegment.country ?? null
  };
}

export {
  exchangeAuthorizationCode,
  refreshAccessToken,
  getActivity,
  listAthleteActivities,
  getSegment,
  getAthleteProfile,
  mapStravaSegmentToSegmentRow,
  createStravaClient,
  type OAuthTokenData,
  type RefreshTokenResponse,
  type Activity,
  type SegmentEffort,
  type StravaApiSegment,
  type ListActivitiesOptions,
  type StravaClientInstance
};
