import React from 'react'; // Removed useState, useEffect
import { useCurrentUser } from '../hooks/useCurrentUser';
import StravaAthleteBadge from './StravaAthleteBadge';
import { Season } from '../types'; // Still need Season type for props
import { trpc } from '../utils/trpc'; // Import trpc

interface Props {
  season?: Season;
}

const SeasonLeaderboard: React.FC<Props> = ({ season }) => {
  const userAthleteId = useCurrentUser();

  const { data: standings = [], isLoading, isError, error } = trpc.leaderboard.getSeasonLeaderboard.useQuery(
    { seasonId: season?.id! },
    {
      enabled: season?.id !== undefined && season?.id !== null, // Only run if season ID is available
      refetchOnWindowFocus: false, // Prevent refetching on window focus
    }
  );

  if (isLoading) {
    return <div>Loading season standings...</div>;
  }

  if (isError) {
    return <div>Error: {error?.message || 'Failed to load season standings'}</div>;
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
              const isCurrentUser = userAthleteId !== null && userAthleteId === standing.participantId; // Adjusted to participantId
              return (
              <tr key={standing.participantId} style={isCurrentUser ? { backgroundColor: 'var(--wmv-orange-light, #fff5f0)', fontWeight: 500 } : {}}>
                <td style={{ width: '60px' }}>{index + 1}</td>
                <td style={{ width: '200px' }}>
                  <StravaAthleteBadge 
                    athleteId={standing.participantId} // Adjusted to participantId
                    name={standing.name}
                    profilePictureUrl={standing.profile_picture_url} // Assuming this will be available from tRPC
                  />
                </td>
                <td>{standing.totalPoints}</td>
                <td>{standing.weeksCompleted}</td>
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

