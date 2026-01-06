// src/utils/jerseyUtils.ts
import { SeasonStanding } from '../types';

export type JerseyType = 'yellow' | 'polkadot' | 'lantern';

/**
 * Higher-level service to centralize jersey logic for both weekly and season leaderboards.
 */
export class JerseyService {
  /**
   * Determines the jersey for a single entry in a weekly leaderboard.
   */
  static getWeeklyJersey(
    rank: number, 
    isLast: boolean, 
    avgGrade: number
  ): JerseyType | null {
    const isFirst = rank === 1;

    if (isFirst) {
      // Polkadot if avg grade > 2%, else Yellow
      return avgGrade > 2 ? 'polkadot' : 'yellow';
    }

    // Lanterne Rouge for last place, if not also first
    if (isLast && rank !== 1) {
      return 'lantern';
    }

    return null;
  }

  /**
   * Determines the jerseys for all standings in a season leaderboard.
   * Season jerseys:
   * - 1st place overall (rank 1): Yellow
   * - Last place: Lanterne Rouge
   * - Most polkadot-eligible wins: Polkadot
   */
  static getSeasonJerseys(
    standings: SeasonStanding[]
  ): Map<string, JerseyType[]> {
    const jerseys = new Map<string, JerseyType[]>();
    if (standings.length === 0) return jerseys;

    const addJersey = (id: string, type: JerseyType) => {
      const existing = jerseys.get(id) || [];
      if (!existing.includes(type)) {
        jerseys.set(id, [...existing, type]);
      }
    };

    // 1. Overall Leader (Yellow)
    const leader = standings.find(s => s.rank === 1);
    if (leader) {
      addJersey(leader.strava_athlete_id, 'yellow');
    }

    // 2. Last Place (Lantern Rouge)
    const maxRank = Math.max(...standings.map(s => s.rank));
    const lastPlace = standings.find(s => s.rank === maxRank);
    if (lastPlace && lastPlace.rank !== 1) {
      addJersey(lastPlace.strava_athlete_id, 'lantern');
    }

    // 3. Polkadot (Most Polkadot Wins)
    // Find the max polkadot wins among anyone who has at least one
    const polkadotEligible = standings.filter(s => s.polkadotWins > 0);
    if (polkadotEligible.length > 0) {
      const maxWins = Math.max(...polkadotEligible.map(s => s.polkadotWins));
      
      // The person with the most polkadot wins gets the jersey. 
      // If tied, it theoretically goes to the one higher in standings.
      const polkadotWinner = polkadotEligible.find(s => s.polkadotWins === maxWins);
      
      if (polkadotWinner) {
        addJersey(polkadotWinner.strava_athlete_id, 'polkadot');
      }
    }

    return jerseys;
  }
}
