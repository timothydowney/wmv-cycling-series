import React, { useEffect, useRef, useMemo } from 'react';
import { Week } from '../types';
import { formatUnixDateShort } from '../utils/dateUtils';
import { isWeekFuture, isWeekPast } from '../utils/defaultSelection';
import { CheckCircleIcon, CalendarIcon, ClockIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid';
import './TimelineWeekSelector.css';

interface Props {
  weeks: Week[];
  selectedWeekId: number | null;
  setSelectedWeekId: (id: number) => void;
}

const TimelineWeekSelector: React.FC<Props> = ({ weeks, selectedWeekId, setSelectedWeekId }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Sort weeks by date (chronological order)
  const sortedWeeks = useMemo(() => {
    return [...weeks].sort((a, b) => a.start_at - b.start_at);
  }, [weeks]);
  
  const now = Date.now() / 1000;

  // Scroll the selected item into view on mount or when selection changes
  useEffect(() => {
    if (weeks.length === 0 || !scrollContainerRef.current) return;

    let targetElement: Element | null = null;

    if (selectedWeekId) {
      targetElement = scrollContainerRef.current.querySelector(`[data-week-id="${selectedWeekId}"]`);
    } else {
      // If no week selected, try to scroll to the first active or future week
      // (The next upcoming event, or the current one)
      const now = Date.now() / 1000;
      const activeOrFutureWeek = sortedWeeks.find(w => w.end_at >= now);
      if (activeOrFutureWeek) {
        targetElement = scrollContainerRef.current.querySelector(`[data-week-id="${activeOrFutureWeek.id}"]`);
      } else {
        // If all are past, scroll to the last one
        const lastWeek = sortedWeeks[sortedWeeks.length - 1];
        if (lastWeek) {
          targetElement = scrollContainerRef.current.querySelector(`[data-week-id="${lastWeek.id}"]`);
        }
      }
    }

    if (targetElement) {
      targetElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest', 
        inline: 'center' 
      });
    }
  }, [selectedWeekId, weeks, sortedWeeks]); // dependencies updated

  if (weeks.length === 0) {
    return (
      <div className="timeline-empty">
        <p className="week-selector-empty-text">No weeks available.</p>
      </div>
    );
  }

  const getWeekStatus = (week: Week) => {
    if (isWeekPast(week, now)) return 'past';
    if (isWeekFuture(week, now)) return 'future';
    return 'active';
  };

  const renderStatusIcon = (status: string, isSelected: boolean) => {
    if (isSelected) return <CalendarIcon className="timeline-status-icon" />;
    if (status === 'past') return <CheckCircleSolidIcon className="timeline-status-icon" />;
    if (status === 'future') return <ClockIcon className="timeline-status-icon" />;
    return <CheckCircleIcon className="timeline-status-icon" />;
  };

  return (
    <div className="timeline-week-selector" data-testid="timeline-week-selector">
      <div className="timeline-scroll-container" ref={scrollContainerRef}>
        {sortedWeeks.map((week, index) => {
          const isSelected = week.id === selectedWeekId;
          const status = getWeekStatus(week);
          
          return (
            <div
              key={week.id}
              data-week-id={week.id}
              data-testid={`timeline-item-${week.id}`}
              className={`timeline-item ${isSelected ? 'selected' : ''} status-${status}`}
              onClick={() => setSelectedWeekId(week.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setSelectedWeekId(week.id);
                  e.preventDefault();
                }
              }}
              aria-label={`Week ${index + 1}: ${week.week_name}`}
              aria-current={isSelected ? 'step' : undefined}
            >
              <div className="timeline-item-header">
                <span className="timeline-week-label">Week {index + 1}</span>
                {renderStatusIcon(status, isSelected)}
              </div>
              
              <div className="timeline-event-name" title={week.week_name}>
                {week.week_name}
              </div>
              
              <div className="timeline-date">
                {formatUnixDateShort(week.start_at)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TimelineWeekSelector;
