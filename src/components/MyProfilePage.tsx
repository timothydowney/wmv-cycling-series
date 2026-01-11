import React from 'react';
import { Link, useParams } from 'react-router-dom';
import './MyProfilePage.css';
import { JerseyIcon } from './JerseyIcon';
import { trpc } from '../utils/trpc';

const MyProfilePage: React.FC = () => {
  const { athleteId } = useParams<{ athleteId: string }>();

  // Fetch profile data from tRPC
  const profileQuery = trpc.profile.getMyProfile.useQuery(
    { athleteId: athleteId || '' },
    { 
      enabled: !!athleteId,
      refetchOnWindowFocus: false 
    }
  );

  if (profileQuery.isLoading) {
    return <div className="profile-page"><p>Loading profile...</p></div>;
  }

  if (profileQuery.error) {
    return <div className="profile-page"><p>Error loading profile: {profileQuery.error.message}</p></div>;
  }

  if (!profileQuery.data) {
    return <div className="profile-page"><p>Profile not found.</p></div>;
  }

  const { name: athleteName, seasonStats, profilePictureUrl } = profileQuery.data;
  
  const closedSeasons = seasonStats.filter(s => s.isActive === 0);
  const activeSeasons = seasonStats.filter(s => s.isActive === 1);

  return (
    <div className="profile-container">
      <div className="profile-header-new">
        <div className="profile-avatar-container">
          {profilePictureUrl ? (
            <img src={profilePictureUrl} alt={athleteName} className="profile-avatar-large" />
          ) : (
            <div className="profile-avatar-placeholder">{athleteName.charAt(0)}</div>
          )}
        </div>
        <div className="profile-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <a 
              href={`https://www.strava.com/athletes/${athleteId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="profile-name-link"
              title="View on Strava"
            >
              <h1>{athleteName}</h1>
            </a>
          </div>
          <div className="profile-stats-summary">
            <span className="summary-item">
              <strong>{seasonStats.length}</strong> {seasonStats.length === 1 ? 'Season' : 'Seasons'}
            </span>
            <span className="summary-divider">•</span>
            <span className="summary-item">
              <strong>{seasonStats.reduce((acc, s) => acc + s.weeksParticipated, 0)}</strong> Weeks
            </span>
          </div>
        </div>
      </div>

      {/* Active Seasons Section */}
      {activeSeasons.length > 0 && (
        <div className="profile-content-section">
          <h2>Current Season</h2>
          <div className="profile-grid">
            {activeSeasons.map(season => (
              <div key={season.seasonId} className="profile-card active-season">
                <div className="card-header-main">
                  <h3>
                    <Link to={`/leaderboard/${season.seasonId}/season`} className="season-link">
                      {season.seasonName}
                    </Link>
                  </h3>
                  {season.seasonRank > 0 && (
                    <span className="rank-badge current">Current: #{season.seasonRank}</span>
                  )}
                </div>
                
                <div className="stats-row">
                  <div className="stat-pill">
                    <span className="stat-label">Total Points</span>
                    <span className="stat-value">{season.totalPoints}</span>
                  </div>
                  <div className="stat-pill">
                    <span className="stat-label">Weeks</span>
                    <span className="stat-value">{season.weeksParticipated}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Palmarès Section */}
      {closedSeasons.length > 0 && (
        <div className="profile-content-section">
          <h2>Palmarès</h2>
          <div className="profile-grid">
            {closedSeasons.map(season => (
              <div key={season.seasonId} className="profile-card closed-season">
                <div className="card-header-main">
                  <h3>
                    <Link to={`/leaderboard/${season.seasonId}/season`} className="season-link">
                      {season.seasonName}
                    </Link>
                  </h3>
                  <div className="jersey-achievements">
                    {season.seasonRank > 0 && (
                      <span className="rank-badge">#{season.seasonRank}</span>
                    )}
                    {season.yellowJerseyWon && (
                      <div className="mini-jersey-badge" title="Overall Season Winner">
                        <JerseyIcon type="yellow" size={18} />
                      </div>
                    )}
                    {season.polkaDotJerseyWon && (
                      <div className="mini-jersey-badge" title="Hill Climb Winner">
                        <JerseyIcon type="polkadot" size={18} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="stats-row highlight">
                  <div className="stat-box">
                    <span className="stat-label">Final Points</span>
                    <span className="stat-value">{season.totalPoints}</span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-label">Weeks</span>
                    <span className="stat-value">{season.weeksParticipated}</span>
                  </div>
                </div>

                <div className="wins-section">
                  <div className="win-item">
                    <div className="win-icon tt">
                      <JerseyIcon type="yellow" size={24} />
                    </div>
                    <div className="win-info">
                      <span className="win-count">{season.timeTrialWins}</span>
                      <span className="win-label">Time Trial Wins</span>
                    </div>
                  </div>
                  <div className="win-item">
                    <div className="win-icon hc">
                      <JerseyIcon type="polkadot" size={24} />
                    </div>
                    <div className="win-info">
                      <span className="win-count">{season.polkaDotWins}</span>
                      <span className="win-label">Hill Climb Wins</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {seasonStats.length === 0 && (
        <div className="profile-empty">
          <p>You haven't participated in any seasons yet.</p>
        </div>
      )}
    </div>
  );
};

export default MyProfilePage;
