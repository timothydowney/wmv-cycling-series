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
            <th>PR Bonus</th>
            <th>Activity</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.length === 0 ? (
            <tr>
              <td colSpan={6}>No results yet for this week</td>
            </tr>
          ) : (
            leaderboard.map(entry => (
              <tr key={entry.participant_id}>
                <td>{entry.rank}</td>
                <td>{entry.name}</td>
                <td>{entry.time_hhmmss}</td>
                <td>{entry.points}</td>
                <td>{entry.pr_bonus_points > 0 ? '⭐ +1' : ''}</td>
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
