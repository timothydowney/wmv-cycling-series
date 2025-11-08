import React, { useState, useEffect } from 'react';
import { getSeasonLeaderboard, SeasonStanding } from '../api';

const SeasonLeaderboard: React.FC = () => {
  const [standings, setStandings] = useState<SeasonStanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSeasonStandings = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getSeasonLeaderboard();
        setStandings(data);
      } catch (err) {
        setError('Failed to load season standings');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSeasonStandings();
  }, []);

  if (loading) {
    return <div>Loading season standings...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <h2>Season Leaderboard</h2>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Name</th>
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
              <tr key={standing.participant_id}>
                <td>{index + 1}</td>
                <td>{standing.name}</td>
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
