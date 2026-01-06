import React, { useMemo } from 'react'; // Added useMemo
import { useCurrentUser } from '../hooks/useCurrentUser';
import { SeasonCard } from './SeasonCard';
import { Season } from '../types'; 
import { trpc } from '../utils/trpc'; 
import { JerseyService } from '../utils/jerseyUtils'; // Import JerseyService

interface Props {
  season?: Season;
}

const SeasonLeaderboard: React.FC<Props> = ({ season }) => {
  const userAthleteId = useCurrentUser();

  const { data: standings = [], isLoading, isError, error } = trpc.leaderboard.getSeasonLeaderboard.useQuery(
    { seasonId: season?.id ?? 0 },
    {
      enabled: season?.id !== undefined && season?.id !== null, 
      refetchOnWindowFocus: false, 
    }
  );

  // Calculate jerseys for the whole leaderboard
  const jerseys = useMemo(() => JerseyService.getSeasonJerseys(standings), [standings]);

  if (isLoading) {
    return <div>Loading season standings...</div>;
  }

  if (isError) {
    return <div>Error: {error?.message || 'Failed to load season standings'}</div>;
  }

  return (
    <div className="weekly-leaderboard-container">
      <div style={{ marginBottom: '12px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--wmv-purple)', marginTop: 0 }}>
          Season Leaderboard
        </h2>
      </div>

      <div className="leaderboard-list">
        {standings.length === 0 ? (
          <div className="no-results">
            No season results yet.
          </div>
        ) : (
          standings.map((standing) => {
            const isCurrentUser = userAthleteId !== null && userAthleteId === standing.strava_athlete_id;
            const jerseyTypes = jerseys.get(standing.strava_athlete_id) || [];

            return (
              <SeasonCard
                key={standing.strava_athlete_id}
                rank={standing.rank}
                participantName={standing.name}
                profilePictureUrl={standing.profile_picture_url}
                totalPoints={standing.totalPoints}
                weeksCompleted={standing.weeksCompleted}
                isCurrentUser={isCurrentUser}
                stravaAthleteId={standing.strava_athlete_id}
                jerseyTypes={jerseyTypes}
              />
            );
          })
        )}
      </div>
    </div>
  );
};

export default SeasonLeaderboard;

