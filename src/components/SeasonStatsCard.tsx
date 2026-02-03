import React from 'react';
import { Link } from 'react-router-dom';
import { JerseyIcon } from './JerseyIcon';
import './MyProfilePage.css';

export interface SeasonStats {
  seasonId: number;
  seasonName: string;
  isActive: number | null;
  totalPoints: number;
  weeksParticipated: number;
  seasonRank: number;
  totalSeasonParticipants: number;
  yellowJerseyWon: boolean;
  polkaDotJerseyWon: boolean;
  polkaDotWins: number;
  timeTrialWins: number;
  bestTTWeeklyRank: number | null;
  bestHCWeeklyRank: number | null;
}

interface SeasonStatsCardProps {
  season: SeasonStats;
}

export const SeasonStatsCard: React.FC<SeasonStatsCardProps> = ({ season }) => {
  const isCurrentlyActive = season.isActive === 1;

  return (
    <div className={`profile-card ${isCurrentlyActive ? 'active-season' : 'closed-season'}`}>
      <div className="season-card-content">
        <div className="season-main-info">
          <div className="card-header-main" style={{ marginBottom: '12px' }}>
            <h3 style={{ fontSize: '1.75rem' }}>
              <Link to={`/leaderboard/${season.seasonId}/season`} className="season-link">
                {season.seasonName}
              </Link>
            </h3>
          </div>

          <div className="season-overall-rank" style={{ marginTop: 0, padding: '20px' }}>
            <span className="rank-value" style={{ fontSize: '3rem' }}>#{season.seasonRank}</span>
            <span className="rank-total">of {season.totalSeasonParticipants} participants</span>
          </div>

          {(season.yellowJerseyWon || season.polkaDotJerseyWon) && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '16px' }}>
              {season.yellowJerseyWon && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                  <div className="career-icon-wrapper" style={{ width: '64px', height: '64px', marginBottom: '8px', background: '#fefce8' }}>
                    <JerseyIcon type="yellow" size={40} />
                  </div>
                  <span className="career-label" style={{ fontSize: '0.7rem' }}>Overall<br/>Champion</span>
                </div>
              )}
              {season.polkaDotJerseyWon && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                  <div className="career-icon-wrapper" style={{ width: '64px', height: '64px', marginBottom: '8px', background: '#fff1f2' }}>
                    <JerseyIcon type="polkadot" size={40} />
                  </div>
                  <span className="career-label" style={{ fontSize: '0.7rem' }}>KOM<br/>Champion</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="season-stats-overview">
          <div className="stats-row highlight" style={{ marginBottom: 0 }}>
            <div className="stat-box">
              <span className="career-label">Total Points</span>
              <span className="career-value">{season.totalPoints}</span>
            </div>
            <div className="stat-box">
              <span className="career-label">Weeks Participated</span>
              <span className="career-value">{season.weeksParticipated}</span>
            </div>
          </div>

          <div className="season-bests-grid" style={{ margin: 0, gap: '20px' }}>
            <div className="career-stat-card mini" style={{ padding: '20px' }}>
              <div className="career-icon-wrapper" style={{ height: '48px', width: '48px' }}>
                 <JerseyIcon type="yellow" size={28} />
              </div>
              <span className="career-label">Best TT Rank</span>
              <span className="career-value" style={{ fontSize: '1.75rem' }}>
                {season.bestTTWeeklyRank ? `#${season.bestTTWeeklyRank}` : '-'}
              </span>
            </div>
            
            <div className="career-stat-card mini" style={{ padding: '20px' }}>
              <div className="career-icon-wrapper" style={{ height: '48px', width: '48px' }}>
                 <JerseyIcon type="polkadot" size={28} />
              </div>
              <span className="career-label">Best HC Rank</span>
              <span className="career-value" style={{ fontSize: '1.75rem' }}>
                {season.bestHCWeeklyRank ? `#${season.bestHCWeeklyRank}` : '-'}
              </span>
            </div>

            {season.timeTrialWins > 0 && (
              <div className="career-stat-card mini" style={{ padding: '20px' }}>
                <div className="career-icon-wrapper" style={{ height: '48px', width: '48px' }}>
                   <JerseyIcon type="yellow" size={28} />
                </div>
                <span className="career-label">TT Wins</span>
                <span className="career-value" style={{ fontSize: '1.75rem' }}>
                  {season.timeTrialWins}
                </span>
              </div>
            )}

            {season.polkaDotWins > 0 && (
              <div className="career-stat-card mini" style={{ padding: '20px' }}>
                <div className="career-icon-wrapper" style={{ height: '48px', width: '48px' }}>
                   <JerseyIcon type="polkadot" size={28} />
                </div>
                <span className="career-label">HC Wins</span>
                <span className="career-value" style={{ fontSize: '1.75rem' }}>
                  {season.polkaDotWins}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
