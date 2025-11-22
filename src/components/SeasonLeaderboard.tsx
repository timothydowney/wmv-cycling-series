import React, { useState, useEffect } from 'react';
import { getSeasonLeaderboard, SeasonStanding } from '../api';
import { useCurrentUser } from '../hooks/useCurrentUser';
import StravaAthleteBadge from './StravaAthleteBadge';

import { Season } from '../api';

interface Props {
  season?: Season;
}

const SeasonLeaderboard: React.FC<Props> = ({ season }) => {
  const [standings, setStandings] = useState<SeasonStanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userAthleteId = useCurrentUser();

  useEffect(() => {
    const fetchSeasonStandings = async () => {
      if (!season?.id) return;
      try {
        setLoading(true);
        setError(null);
        const data = await getSeasonLeaderboard(season.id);
        setStandings(data);
      } catch (err) {
        setError('Failed to load season standings');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSeasonStandings();
  }, [season?.id]);

  if (loading) {
    return <div>Loading season standings...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <h2>Season | {season?.name || 'Unknown'} | Leaderboard</h2>
      <table style={{ width: '100%' }}>
        <thead>
          <tr>
            <th style={{ width: '60px' }}>Rank</th>
            <th style={{ width: '200px' }}>Name</th>
            <th>Total Points</th>
            <th>Weeks Completed</th>
          </tr>
        </thead>
        <tbody>
          {standings.length === 0 ? (
            <tr>
              <td colSpan={4}>No season results yet</td>
            </tr>
          ) : (
            standings.map((standing, index) => {
              const isCurrentUser = userAthleteId !== null && userAthleteId === standing.strava_athlete_id;
              return (
              <tr key={standing.id} style={isCurrentUser ? { backgroundColor: 'var(--wmv-orange-light, #fff5f0)', fontWeight: 500 } : {}}>
                <td style={{ width: '60px' }}>{index + 1}</td>
                <td style={{ width: '200px' }}>
                  <StravaAthleteBadge 
                    athleteId={standing.strava_athlete_id} 
                    name={standing.name}
                    profilePictureUrl={standing.profile_picture_url}
                  />
                </td>
                <td>{standing.total_points}</td>
                <td>{standing.weeks_completed}</td>
              </tr>
            );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

export default SeasonLeaderboard;
