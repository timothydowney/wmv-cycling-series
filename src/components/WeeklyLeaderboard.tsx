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
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState<number | null>(null);
  const hasAutoExpanded = useRef(false);

  // Reset expansion when week changes
  useEffect(() => {
    setExpandedCardId(null);
    setIsNotesExpanded(false);
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

  const hasNotes = !!week.notes;

  return (
    <div className="weekly-leaderboard-container">
      <div style={{ position: 'relative', marginBottom: hasNotes && isNotesExpanded ? '16px' : '24px' }}>
        <WeeklyHeader
          week={week}
          weekNumber={weekNumber}
          participantCount={week.participants_count}
          onClick={hasNotes ? () => setIsNotesExpanded(!isNotesExpanded) : undefined}
          isExpanded={isNotesExpanded}
          hasNotes={hasNotes}
        />

        {hasNotes && isNotesExpanded && (
          <div style={{
            marginTop: '-24px', // Pull up to connect with header
            marginLeft: '16px',
            marginRight: '16px',
            backgroundColor: '#f9fafb',
            borderBottomLeftRadius: '16px',
            borderBottomRightRadius: '16px',
            border: '1px solid #e5e7eb',
            borderTop: 'none',
            padding: '24px',
            paddingTop: '32px', // Extra padding to clear the overlap
            animation: 'slideDown 0.2s ease-out',
            position: 'relative',
            zIndex: 0
          }}>
            <NotesDisplay markdown={week.notes!} />
          </div>
        )}
      </div>

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
