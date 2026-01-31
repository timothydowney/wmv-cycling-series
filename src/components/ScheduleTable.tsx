import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Week } from '../types';
import { NotesDisplay } from './NotesDisplay';
import { WeeklyHeader } from './WeeklyHeader';
import { CollapsibleSegmentProfile } from './CollapsibleSegmentProfile';
import './ScheduleTable.css';

interface Props {
  weeks: Week[];
}

const ScheduleTable: React.FC<Props> = ({ weeks }) => {
  const [expandedWeekId, setExpandedWeekId] = useState<number | null>(null);
  const cardRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const hasScrolledRef = useRef(false);

  // Sort weeks by start_at date
  const sortedWeeks = [...weeks].sort((a, b) => a.start_at - b.start_at);

  // Find the next week that will happen (first week that hasn't ended yet)
  const now = Math.floor(Date.now() / 1000);
  const nextWeek = sortedWeeks.find(week => week.end_at >= now);

  useEffect(() => {
    // Only scroll to next week once on mount/data load
    if (nextWeek && !hasScrolledRef.current) {
      setExpandedWeekId(nextWeek.id);
      hasScrolledRef.current = true;
      
      // Small timeout to ensure DOM is ready and expansion has started
      setTimeout(() => {
        const element = cardRefs.current[nextWeek.id];
        if (element) {
          // Manual scroll calculation to account for the fixed navbar (60px) + spacing
          const headerOffset = 85; 
          const elementPosition = element.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.scrollY - headerOffset;
          
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }
      }, 300);
    }
  }, [nextWeek]);

  const toggleWeek = (weekId: number) => {
    setExpandedWeekId(expandedWeekId === weekId ? null : weekId);
  };

  return (
    <div className="season-schedule-container" style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <div className="schedule-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {sortedWeeks.map((week, index) => {
          const isExpanded = expandedWeekId === week.id;
          const isNextUp = nextWeek?.id === week.id;


          return (
            <div 
              key={week.id} 
              ref={el => { cardRefs.current[week.id] = el; }}
              className={`schedule-card-wrapper ${isNextUp ? 'upcoming-week' : ''}`} 
              style={{ position: 'relative' }}
            >

              {/* Next Up Badge */}
              {isNextUp && (
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
