import React from 'react';
import { Week, LeaderboardEntry } from '../api';

interface Props {
  week: Week | null;
  leaderboard: LeaderboardEntry[];
}

const WeeklyLeaderboard: React.FC<Props> = ({ week, leaderboard }) => {
  if (!week) {
    return <div>Select a week to view the leaderboard</div>;
  }

  return (
    <div>
      <h2>{week.week_name} Leaderboard</h2>
      <p>Date: {week.date} | Segment: {week.segment_id} | Laps: {week.required_laps}</p>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Name</th>
            <th>Time</th>
            <th>Points</th>
            <th>Activity</th>
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
                <td>{entry.rank}</td>
                <td>{entry.name}</td>
                <td>
                  {/* Show effort breakdown if multiple laps required */}
                  {entry.effort_breakdown && entry.effort_breakdown.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {entry.effort_breakdown.map((effort, i) => (
                        <div key={i} style={{ fontSize: '0.9em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>Lap {effort.lap}: {effort.time_hhmmss}</span>
                          {effort.is_pr && <span style={{ marginLeft: '8px', color: '#ff6b35' }}>⭐</span>}
                        </div>
                      ))}
                      <div style={{ borderTop: '1px solid #ccc', paddingTop: '4px', fontWeight: 'bold' }}>
                        Total: {entry.time_hhmmss}
                      </div>
                    </div>
                  ) : (
                    /* Show just the time if single lap */
                    entry.time_hhmmss
                  )}
                </td>
                <td>{entry.points}{entry.pr_bonus_points > 0 ? ` + ${entry.pr_bonus_points}` : ''}</td>
                <td>
                  {entry.activity_url ? (
                    <a href={entry.activity_url} target="_blank" rel="noopener noreferrer">
                      View
                    </a>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default WeeklyLeaderboard;
