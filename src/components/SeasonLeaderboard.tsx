import React, { useState, useEffect } from 'react';
import { getSeasonLeaderboard, SeasonStanding } from '../api';

import { Season } from '../api';

interface Props {
  season?: Season;
}

const SeasonLeaderboard: React.FC<Props> = ({ season }) => {
  const [standings, setStandings] = useState<SeasonStanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            standings.map((standing, index) => (
              <tr key={standing.id}>
                <td style={{ width: '60px' }}>{index + 1}</td>
                <td style={{ width: '200px' }}>
                  <a 
                    href={`https://www.strava.com/athletes/${standing.strava_athlete_id}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ color: 'var(--wmv-purple)', fontWeight: 600, textDecoration: 'none' }}
                  >
                    {standing.name}
                  </a>
                </td>
                <td>{standing.total_points}</td>
                <td>{standing.weeks_completed}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default SeasonLeaderboard;
