import React, { useState, useEffect, useRef } from 'react';
import { Week, LeaderboardEntry } from '../types';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { NotesDisplay } from './NotesDisplay';
import { WeeklyHeader } from './WeeklyHeader';
import { LeaderboardCard } from './LeaderboardCard';
import { CollapsibleSegmentProfile } from './CollapsibleSegmentProfile';
import './WeeklyLeaderboard.css';

interface Props {
  week: Week | null;
  leaderboard: LeaderboardEntry[];
  weekNumber?: number;
}

const WeeklyLeaderboard: React.FC<Props> = ({ week, leaderboard, weekNumber }) => {
  const userAthleteId = useCurrentUser();
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const hasAutoExpanded = useRef(false);

  // Reset expansion when week changes
  useEffect(() => {
    setExpandedCardId(null);
    // Weekly leaderboard is now collapsed by default to keep UI clean
    setIsNotesExpanded(false);
    hasAutoExpanded.current = false; // Reset auto-expansion flag when week changes
  }, [week?.id, week?.notes, week?.strava_segment_id]);

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

  const handleCardToggle = (participantId: string) => {
    setExpandedCardId(prev => (prev === participantId ? null : participantId));
  };

  if (!week) {
    return (
      <div className="weekly-leaderboard-container" data-testid="weekly-leaderboard">
        <h2 style={{ textAlign: 'center', color: 'var(--wmv-text-light)' }}>
          Select a week to view results
        </h2>
      </div>
    );
  }



  return (
    <div className="weekly-leaderboard-container" data-testid="weekly-leaderboard">
      <div style={{ position: 'relative', marginBottom: isNotesExpanded ? '16px' : '24px' }}>
        <WeeklyHeader
          week={week}
          weekNumber={weekNumber}
          participantCount={week.participants_count}
          onClick={() => {
            console.log('Toggling notes:', !isNotesExpanded);
            setIsNotesExpanded(prev => !prev);
          }}
          isExpanded={isNotesExpanded}

        />

        {isNotesExpanded && (
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
            {week.notes && (
              <NotesDisplay markdown={week.notes} />
            )}

            {week.strava_segment_id && (
              <div style={{ marginTop: week.notes ? '24px' : '0' }}>
                <CollapsibleSegmentProfile segmentId={week.strava_segment_id} />
              </div>
            )}
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
              isLast={entry.rank === leaderboard.length}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default WeeklyLeaderboard;
