import React, { useState, useRef } from 'react';
import { Week, LeaderboardEntry } from '../types';
import { formatLapCount } from '../utils/lapFormatter';
import { formatUnixDate } from '../utils/dateUtils';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { NotesDisplay } from './NotesDisplay';
import StravaAthleteBadge from './StravaAthleteBadge';
import './WeeklyLeaderboard.css';

interface Props {
  week: Week | null;
  leaderboard: LeaderboardEntry[];
  weekNumber?: number;
}

const WeeklyLeaderboard: React.FC<Props> = ({ week, leaderboard, weekNumber }) => {
  const userAthleteId = useCurrentUser();
  const [expandedPointsId, setExpandedPointsId] = useState<number | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Always render the component - show a generic title if no week selected
  const formattedDate = week ? formatUnixDate(week.start_at) : null;
  const title = week ? (
    <h2>
      Week {weekNumber} | {formattedDate} |&nbsp;
      <a 
        href={`https://www.strava.com/segments/${week.segment_id}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: 'var(--wmv-purple)', textDecoration: 'none' }}
      >
        {week.week_name}
      </a>
      &nbsp;| {formatLapCount(week.required_laps)}
    </h2>
  ) : (
    <h2>Week | Leaderboard</h2>
  );

  return (
    <div style={{ marginBottom: '2rem' }}>
      {title}
      {week?.notes && (
        <div className="week-notes-display">
          <NotesDisplay markdown={week.notes} />
        </div>
      )}
      <table style={{ width: '100%' }}>
        <thead>
          <tr>
            <th style={{ width: '60px' }}>Rank</th>
            <th style={{ width: '200px' }}>Name</th>
            <th>Time</th>
            <th>Points</th>
            <th>Device</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.length === 0 ? (
            <tr>
              <td colSpan={5}>No results yet for this week</td>
            </tr>
          ) : (
            leaderboard.map((entry) => {
              const isCurrentUser = userAthleteId !== null && userAthleteId === entry.participant_id;
              return (
              <tr key={entry.participant_id} style={isCurrentUser ? { backgroundColor: 'var(--wmv-orange-light, #fff5f0)', fontWeight: 500 } : {}}>
                <td style={{ width: '60px' }}>{entry.rank}</td>
                <td style={{ width: '200px' }}>
                  <StravaAthleteBadge 
                    athleteId={entry.participant_id} 
                    name={entry.name} 
                    profilePictureUrl={entry.profile_picture_url}
                  />
                </td>
                <td>
                  {/* Extract activity ID from URL: https://www.strava.com/activities/123456789/ */}
                  {(() => {
                    const activityId = entry.activity_url?.match(/activities\/(\d+)/)?.[1];
                    // Show PR star if this entry has a PR bonus (pr_bonus_points > 0)
                    const hasPR = entry.pr_bonus_points > 0;
                    
                    return (
                      <>
                        {/* Show effort breakdown if multiple laps required */}
                        {entry.effort_breakdown && entry.effort_breakdown.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {entry.effort_breakdown.map((effort, i) => (
                              <div key={i} style={{ fontSize: '0.9em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>
                                  Lap {effort.lap}:{' '}
                                  {effort.strava_effort_id && activityId ? (
                                    <a 
                                      href={`https://www.strava.com/activities/${activityId}/segments/${effort.strava_effort_id}`}
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      style={{ color: 'var(--wmv-orange)', textDecoration: 'none', fontWeight: 500 }}
                                    >
                                      {effort.time_hhmmss}
                                    </a>
                                  ) : (
                                    effort.time_hhmmss
                                  )}
                                </span>
                                {effort.is_pr && <span style={{ marginLeft: '8px', color: '#ff6b35' }}>🏆</span>}
                              </div>
                            ))}
                            <div style={{ borderTop: '1px solid #ccc', paddingTop: '4px', color: 'var(--wmv-purple)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>Total: {entry.time_hhmmss}</span>
                              {hasPR && <span style={{ marginLeft: '8px', color: '#ffd700' }}>🏆</span>}
                            </div>
                          </div>
                        ) : (
                          /* Show just the time if single lap, as a link */
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {entry.strava_effort_id && activityId ? (
                              <a 
                                href={`https://www.strava.com/activities/${activityId}/segments/${entry.strava_effort_id}`}
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={{ color: 'var(--wmv-orange)', textDecoration: 'none', fontWeight: 500 }}
                              >
                                {entry.time_hhmmss}
                              </a>
                            ) : (
                              entry.time_hhmmss
                            )}
                            {hasPR && <span style={{ color: '#ffd700' }}>🏆</span>}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </td>
                <td>
                  <div className="points-with-info">
                    {(() => {
                      const multiplier = week?.multiplier || 1;
                      const baseTotal = entry.points / multiplier;
                      const beaten = baseTotal - 1 - entry.pr_bonus_points; // base = beaten + 1 (participation) + pr
                      const participation = 1;
                      const prBonus = entry.pr_bonus_points;
                      
                      // Build calculation string
                      let calculation = `${beaten} beaten + ${participation} participation`;
                      if (prBonus > 0) calculation += ` + ${prBonus} PR`;
                      calculation += ` = ${baseTotal}`;
                      if (multiplier > 1) calculation += ` × ${multiplier} = ${entry.points}`;
                      
                      return (
                        <>
                          <span>{entry.points}</span>
                          <button
                            className="points-info-btn"
                            onClick={() => setExpandedPointsId(expandedPointsId === entry.participant_id ? null : entry.participant_id)}
                            title="Show points breakdown"
                            aria-label="Show points breakdown"
                          >
                            ⓘ
                          </button>
                          {expandedPointsId === entry.participant_id && (
                            <div className="points-breakdown-popup" ref={popupRef}>
                              {calculation}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </td>
                <td>{entry.device_name || '—'}</td>
              </tr>
            );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

export default WeeklyLeaderboard;
