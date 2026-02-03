import React from 'react';
import { useParams } from 'react-router-dom';
import './MyProfilePage.css';
import { JerseyIcon } from './JerseyIcon';
import { trpc } from '../utils/trpc';
import { BoltIcon, ClockIcon, FireIcon, CalendarDaysIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { SeasonStatsCard } from './SeasonStatsCard';

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

  const { name: athleteName, seasonStats, profilePictureUrl, careerStats } = profileQuery.data;
  
  const closedSeasons = seasonStats.filter(s => s.isActive === 0);
  const activeSeasons = seasonStats.filter(s => s.isActive === 1);
  const totalWeeks = seasonStats.reduce((acc, s) => acc + s.weeksParticipated, 0);

  return (
    <div className="profile-container">
      <div className="profile-header-centered">
        <div className="profile-avatar-container-center">
          {profilePictureUrl ? (
            <img src={profilePictureUrl} alt={athleteName} className="profile-avatar-xl" />
          ) : (
            <div className="profile-avatar-placeholder-xl">{athleteName.charAt(0)}</div>
          )}
        </div>
        <div className="profile-info-center">
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
      </div>

      {/* Career Highlights Section */}
      {careerStats && (
        <div className="profile-content-section">
          <h2>Career Highlights</h2>
          <div className="career-stats-grid">
            
            {/* Participation Stats (Moved from Header) */}
            <div className="career-stat-card">
              <div className="career-icon-wrapper">
                <CalendarDaysIcon className="h-6 w-6" />
              </div>
              <span className="career-label">Seasons<br/>Active</span>
              <span className="career-value">{seasonStats.length}</span>
            </div>

            <div className="career-stat-card">
              <div className="career-icon-wrapper">
                <CheckCircleIcon className="h-6 w-6" />
              </div>
              <span className="career-label">Weeks<br/>Completed</span>
              <span className="career-value">{totalWeeks}</span>
            </div>

            {/* Performance Stats */}
             <div className="career-stat-card">
              <div className="career-icon-wrapper">
                <FireIcon className="h-6 w-6" />
              </div>
              <span className="career-label">Longest<br/>Streak</span>
              <span className="career-value">
                {careerStats.longestStreak}
                <span className="unit-label">Weeks</span>
              </span>
            </div>

            {careerStats.bestPower !== null && (
              <div className="career-stat-card">
                <div className="career-icon-wrapper">
                  <BoltIcon className="h-6 w-6" />
                </div>
                <span className="career-label">Best Power<br/>(Avg)</span>
                <span className="career-value">
                  {Math.round(careerStats.bestPower)}
                  <span className="unit-label">W</span>
                </span>
              </div>
            )}

            <div className="career-stat-card">
              <div className="career-icon-wrapper">
                <ClockIcon className="h-6 w-6" />
              </div>
              <span className="career-label">Total PRs<br/>(In Comp)</span>
              <span className="career-value">
                {careerStats.totalPrs}
              </span>
            </div>

            {/* Jersey Achievements */}
            <div className="career-stat-card">
              <div className="career-icon-wrapper">
                <JerseyIcon type="yellow" size={28} />
              </div>
              <span className="career-label">Best TT<br/>Weekly Result</span>
              <span className="career-value">
                {careerStats.bestTimeTrialWeeklyRank ? `#${careerStats.bestTimeTrialWeeklyRank}` : '-'}
              </span>
            </div>

            <div className="career-stat-card">
              <div className="career-icon-wrapper">
                <JerseyIcon type="polkadot" size={28} />
              </div>
              <span className="career-label">Best HC<br/>Weekly Result</span>
              <span className="career-value">
                {careerStats.bestHillClimbWeeklyRank ? `#${careerStats.bestHillClimbWeeklyRank}` : '-'}
              </span>
            </div>
            
            <div className="career-stat-card">
              <div className="career-icon-wrapper">
                <div style={{ opacity: 0.6 }}><JerseyIcon type="yellow" size={28} /></div>
              </div>
              <span className="career-label">Best TT<br/>Season Place</span>
              <span className="career-value">
                {careerStats.bestTimeTrialSeasonRank ? `#${careerStats.bestTimeTrialSeasonRank}` : '-'}
              </span>
            </div>

            <div className="career-stat-card">
              <div className="career-icon-wrapper">
                <div style={{ opacity: 0.6 }}><JerseyIcon type="polkadot" size={28} /></div>
              </div>
              <span className="career-label">Best HC<br/>Season Place</span>
              <span className="career-value">
                {careerStats.bestHillClimbSeasonRank ? `#${careerStats.bestHillClimbSeasonRank}` : '-'}
              </span>
            </div>

          </div>
        </div>
      )}

      {/* Active Seasons Section */}
      {activeSeasons.length > 0 && (
        <div className="profile-content-section">
          <h2>Current Season</h2>
          <div className="profile-grid">
            {activeSeasons.map(season => (
              <SeasonStatsCard key={season.seasonId} season={season} />
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
              <SeasonStatsCard key={season.seasonId} season={season} />
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
