/**
 * ClubService.ts
 *
 * Manages Strava club membership checking.
 *
 * Architecture:
 * - Calls getLoggedInAthlete() endpoint which returns athlete's clubs
 * - Checks if target club ID is in athlete's clubs array
 * - Simple, real-time, no caching needed
 * - Gracefully handles API errors with logging
 *
 * Design rationale:
 * - The club members endpoint (/clubs/{id}/members) returns member details
 *   but NO athlete IDs, making reverse-lookup impossible
 * - Instead, we use the athlete endpoint (/athlete) which returns the
 *   authenticated athlete's profile INCLUDING clubs they belong to
 * - This is simpler, requires fewer API calls, and is always current
 *
 * Usage:
 *   const service = new ClubService();
 *   const isMember = await service.isMemberOfClub(clubId, accessToken);
 */

import { getLoggedInAthlete } from '../stravaClient';
import { getValidAccessToken } from '../tokenManager';
import * as stravaClient from '../stravaClient';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

interface AthleteClub {
  id: number;
  resource_state?: number;
  name?: string;
  [key: string]: any;
}

export class ClubService {
  constructor(private db: BetterSQLite3Database) {}

  /**
   * Check if a specific athlete is a member of the club.
   * Handles token retrieval, API call, and graceful error handling.
   * 
   * @param athleteId - Strava athlete ID of the participant
   * @param clubId - Target club ID to check membership in
   * @returns true if athlete is a member, false if not or on error
   */
  async checkMember(athleteId: string, clubId: string): Promise<boolean> {
    try {
      // Get valid access token
      const accessToken = await getValidAccessToken(this.db, stravaClient, athleteId);
      
      if (!accessToken) {
        console.warn(`[Club] No access token for athlete ${athleteId}`);
        return false;
      }

      return await this.isMemberOfClub(clubId, accessToken);
    } catch (error) {
      console.error(`[Club] Error checking membership for athlete ${athleteId}:`, error);
      return false;
    }
  }

  /**
   * Internal method to check if the athlete is a member of a club using a token.
   * 
   * @param clubId - Target club ID to check membership in
   * @param accessToken - Valid Strava access token for authenticated athlete
   * @returns true if athlete is a member of the club, false otherwise
   */
  async isMemberOfClub(
    clubId: string,
    accessToken: string
  ): Promise<boolean> {
    try {
      // Get the athlete's profile with clubs array
      const athlete = await getLoggedInAthlete(accessToken);
      
      if (!athlete || !Array.isArray(athlete.clubs)) {
        console.log('[Club] Athlete has no clubs array');
        return false;
      }

      // Check if our club ID is in their clubs
      const clubIdNum = Number(clubId);
      const isMember = athlete.clubs.some((club: AthleteClub) => {
        return Number(club.id) === clubIdNum;
      });

      console.log(
        `[Club] Membership check: athleteId=${athlete.id}, clubId=${clubId}, isMember=${isMember}`
      );

      return isMember;
    } catch (error) {
      // Log error but don't fail - return false (graceful degradation)
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`[Club] Failed to check membership for club ${clubId}: ${errorMsg}`);
      return false;
    }
  }
}

export default ClubService;
