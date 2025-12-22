import React, { useState, useEffect, useRef } from 'react';
import { Week, LeaderboardEntry } from '../types';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { NotesDisplay } from './NotesDisplay';
import { WeeklyHeader } from './WeeklyHeader';
import { LeaderboardCard } from './LeaderboardCard';
import './WeeklyLeaderboard.css';

interface Props {
  week: Week | null;
  leaderboard: LeaderboardEntry[];
  weekNumber?: number;
}

const WeeklyLeaderboard: React.FC<Props> = ({ week, leaderboard, weekNumber }) => {
  const userAthleteId = useCurrentUser();
  const [expandedCardId, setExpandedCardId] = useState<number | null>(null);
  const hasAutoExpanded = useRef(false);

  // Reset expansion when week changes
  useEffect(() => {
    setExpandedCardId(null);
    hasAutoExpanded.current = false; // Reset auto-expansion flag when week changes
  }, [week?.id]);

  // Auto-expand the first place winner on load, but only once
  useEffect(() => {
    if (leaderboard.length > 0 && !hasAutoExpanded.current) {
      const winner = leaderboard.find(e => e.rank === 1);
      if (winner) {
        setExpandedCardId(winner.participant_id);
        hasAutoExpanded.current = true;
      }
    }
  }, [leaderboard]);

  const handleCardToggle = (participantId: number) => {
    setExpandedCardId(prev => (prev === participantId ? null : participantId));
  };

  if (!week) {
    return (
      <div className="weekly-leaderboard-container">
        <h2 style={{ textAlign: 'center', color: 'var(--wmv-text-light)' }}>
          Select a week to view results
        </h2>
      </div>
    );
  }

  return (
    <div className="weekly-leaderboard-container">
      <WeeklyHeader
        week={week}
        weekNumber={weekNumber}
        participantCount={week.participants_count}
      />

      {week.notes && (
        <div className="week-notes-display">
          <NotesDisplay markdown={week.notes} />
        </div>
      )}

      <div className="leaderboard-list">
        {leaderboard.length === 0 ? (
          <div className="no-results">
            No results yet for this week.
            <br />
            <small>Go ride the segment!</small>
          </div>
        ) : (
          leaderboard.map((entry) => (
            <LeaderboardCard
              key={entry.participant_id}
              entry={entry}
              week={week}
              rank={entry.rank}
              isExpanded={expandedCardId === entry.participant_id}
              onToggle={() => handleCardToggle(entry.participant_id)}
              isCurrentUser={userAthleteId === entry.participant_id}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default WeeklyLeaderboard;
