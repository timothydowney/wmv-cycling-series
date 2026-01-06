import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Week, Season } from '../types';
import { formatUnixDate } from '../utils/dateUtils';
import { NotesDisplay } from './NotesDisplay';
import { WeeklyHeader } from './WeeklyHeader';
import { CollapsibleSegmentProfile } from './CollapsibleSegmentProfile';
import './ScheduleTable.css';

interface Props {
  weeks: Week[];
  season?: Season;
}

const ScheduleTable: React.FC<Props> = ({ weeks, season }) => {
  const [expandedWeekId, setExpandedWeekId] = useState<number | null>(null);

  // Sort weeks by start_at date
  const sortedWeeks = [...weeks].sort((a, b) => a.start_at - b.start_at);

  // Get season start and end dates
  let seasonStart = '';
  let seasonEnd = '';

  if (season) {
    seasonStart = formatUnixDate(season.start_at);
    seasonEnd = formatUnixDate(season.end_at);
  } else if (sortedWeeks.length > 0) {
    seasonStart = formatUnixDate(sortedWeeks[0].start_at);
    seasonEnd = formatUnixDate(sortedWeeks[sortedWeeks.length - 1].start_at);
  }

  // Find the upcoming week (today or in future)
  const now = Math.floor(Date.now() / 1000);
  const upcomingWeek = sortedWeeks.find(week => week.end_at >= now);

  const toggleWeek = (weekId: number) => {
    setExpandedWeekId(expandedWeekId === weekId ? null : weekId);
  };

  return (
    <div className="season-schedule-container" style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: '12px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--wmv-purple)', marginTop: 0 }}>
          Schedule
        </h2>
        <p style={{ color: 'var(--wmv-text-light)', marginTop: '4px' }}>
          {season?.name || 'Unknown Season'} • {seasonStart} to {seasonEnd}
        </p>
      </div>

      <div className="schedule-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {sortedWeeks.map((week, index) => {
          const isExpanded = expandedWeekId === week.id;
          const isUpcoming = upcomingWeek?.id === week.id;


          return (
            <div key={week.id} className={`schedule-card-wrapper ${isUpcoming ? 'upcoming-week' : ''}`} style={{ position: 'relative' }}>

              {/* Upcoming Label */}
              {isUpcoming && (
                <div className="next-up-badge">
                  Next Up
                </div>
              )}

              <WeeklyHeader
                week={week}
                weekNumber={index + 1}
                participantCount={week.participants_count}
                onClick={() => toggleWeek(week.id)}
                isExpanded={isExpanded}

              />

              {/* Expandable Notes Section */}
              {isExpanded && (
                <div style={{
                  marginTop: '-24px', // Pull up to connect with header
                  marginLeft: '16px',
                  marginRight: '16px',
                  marginBottom: '16px',
                  backgroundColor: '#f9fafb',
                  borderBottomLeftRadius: '16px',
                  borderBottomRightRadius: '16px',
                  border: '1px solid #e5e7eb',
                  borderTop: 'none',
                  padding: '24px',
                  paddingTop: '32px', // Extra padding to clear the overlap
                  animation: 'slideDown 0.2s ease-out'
                }}>
                  {week.notes && (
                    <div style={{ marginBottom: week.strava_segment_id ? '24px' : '0' }}>
                      <h4 style={{
                        margin: '0 0 12px 0',
                        fontSize: '0.9rem',
                        textTransform: 'uppercase',
                        color: 'var(--wmv-text-light)',
                        letterSpacing: '0.05em'
                      }}>
                        Week Notes
                      </h4>
                      <NotesDisplay markdown={week.notes} />
                    </div>
                  )}

                  {week.strava_segment_id && (
                    <div style={{ marginTop: week.notes ? '24px' : '0' }}>
                      <CollapsibleSegmentProfile 
                        segmentId={week.strava_segment_id} 
                        defaultExpanded={true} 
                      />
                    </div>
                  )}

                  <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
                    <Link 
                      to={`/leaderboard/${week.season_id}/weekly/${week.id}`}
                      className="view-results-button"
                      style={{
                        backgroundColor: 'var(--wmv-purple)',
                        color: 'white',
                        padding: '10px 20px',
                        borderRadius: '12px',
                        textDecoration: 'none',
                        fontWeight: 'bold',
                        fontSize: '0.9rem',
                        transition: 'transform 0.2s',
                        display: 'inline-block'
                      }}
                    >
                      View Points & Leaderboard
                    </Link>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ScheduleTable;
