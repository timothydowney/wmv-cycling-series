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

interface AthleteClub {
  id: number;
  resource_state?: number;
  name?: string;
  [key: string]: any;
}

class ClubService {

  /**
   * Check if the logged-in athlete is a member of a club.
   * 
   * Calls getLoggedInAthlete() which returns the athlete's profile including
   * their clubs array. We then check if the target club is in that array.
   * 
   * @param clubId - Target club ID to check membership in
   * @param accessToken - Valid Strava access token for authenticated athlete
   * @returns true if athlete is a member of the club, false otherwise
   * 
   * @throws {Error} If API call fails (will be caught by router)
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

// Export singleton instance
export const clubService = new ClubService();

export default ClubService;