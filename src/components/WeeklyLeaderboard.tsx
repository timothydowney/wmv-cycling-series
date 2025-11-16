import React from 'react';
import { Week, LeaderboardEntry } from '../api';
import { formatLapCount } from '../utils/lapFormatter';
import { formatUnixDate } from '../utils/dateUtils';

interface Props {
  week: Week | null;
  leaderboard: LeaderboardEntry[];
}

const WeeklyLeaderboard: React.FC<Props> = ({ week, leaderboard }) => {
  // Always render the component - show a generic title if no week selected
  const formattedDate = week ? formatUnixDate(week.start_at) : null;
  const title = week ? (
    <h2>
      Week | {formattedDate} |&nbsp;
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
            leaderboard.map((entry) => (
              <tr key={entry.participant_id}>
                <td style={{ width: '60px' }}>{entry.rank}</td>
                <td style={{ width: '200px' }}>
                  {entry.activity_url ? (
                    <a href={entry.activity_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--wmv-purple)', fontWeight: 600, textDecoration: 'none' }}>
                      {entry.name}
                    </a>
                  ) : (
                    entry.name
                  )}
                </td>
                <td>
                  {/* Extract activity ID from URL: https://www.strava.com/activities/123456789/ */}
                  {(() => {
                    const activityId = entry.activity_url?.match(/activities\/(\d+)/)?.[1];
                    
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
                                {effort.is_pr && <span style={{ marginLeft: '8px', color: '#ff6b35' }}>⭐</span>}
                              </div>
                            ))}
                            <div style={{ borderTop: '1px solid #ccc', paddingTop: '4px', color: 'var(--wmv-purple)' }}>
                              Total: {entry.time_hhmmss}
                            </div>
                          </div>
                        ) : (
                          /* Show just the time if single lap, as a link */
                          entry.strava_effort_id && activityId ? (
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
                          )
                        )}
                      </>
                    );
                  })()}
                </td>
                <td>{entry.points}{entry.pr_bonus_points > 0 ? ` + ${entry.pr_bonus_points}` : ''}</td>
                <td>{entry.device_name || '—'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default WeeklyLeaderboard;
