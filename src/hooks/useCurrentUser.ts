import { useState, useEffect } from 'react';
import { getAuthStatus } from '../api';

/**
 * Hook to get the current logged-in user's Strava athlete ID
 * Returns null if user is not authenticated
 */
export function useCurrentUser(): string | null {
  const [userAthleteId, setUserAthleteId] = useState<string | null>(null);

  useEffect(() => {
    const fetchAuthStatus = async () => {
      try {
        const authStatus = await getAuthStatus();
        if (authStatus.authenticated && authStatus.participant) {
          setUserAthleteId(authStatus.participant.strava_athlete_id);
        }
      } catch (err) {
        console.error('Failed to fetch auth status:', err);
      }
    };

    fetchAuthStatus();
  }, []);

  return userAthleteId;
}
