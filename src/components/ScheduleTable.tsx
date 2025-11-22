import React, { useState, useRef, useEffect } from 'react';
import { Week, Season } from '../api';
import { formatUnixDate, formatUnixTime } from '../utils/dateUtils';
import { NotesDisplay } from './NotesDisplay';
import './ScheduleTable.css';

interface Props {
  weeks: Week[];
  season?: Season;
}

const ScheduleTable: React.FC<Props> = ({ weeks, season }) => {
  const [expandedWeekId, setExpandedWeekId] = useState<number | null>(null);
  const [expandedNotesWeekId, setExpandedNotesWeekId] = useState<number | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Sort weeks by start_at date
  const sortedWeeks = [...weeks].sort((a, b) => a.start_at - b.start_at);

  // Get season start and end dates - prefer season prop, fallback to weeks
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
  const now = Math.floor(Date.now() / 1000); // Current Unix timestamp in seconds
  const upcomingWeek = sortedWeeks.find(week => week.end_at >= now);

  // Handle click outside popup to dismiss
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setExpandedWeekId(null);
        setExpandedNotesWeekId(null);
      }
    };

    if (expandedWeekId !== null || expandedNotesWeekId !== null) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [expandedWeekId, expandedNotesWeekId]);

  return (
    <div className="schedule-table-container">
      <h2>Schedule | {season?.name || 'Unknown'} | {seasonStart} to {seasonEnd}</h2>
      <table className="schedule-table">
        <thead>
          <tr>
            <th>Week</th>
            <th>Date</th>
            <th>Course / Segment</th>
            <th>Laps</th>
            <th className="participants-header">Participants</th>
          </tr>
        </thead>
        <tbody>
          {sortedWeeks.map((week, index) => (
            <React.Fragment key={week.id}>
              <tr className={upcomingWeek?.id === week.id ? 'upcoming' : ''}>
                <td className="week-name">
                  <div className="week-name-with-notes">
                    {index + 1}. {week.week_name}
                    {week.notes && (
                      <button
                        className="notes-info-btn"
                        onClick={() => setExpandedNotesWeekId(expandedNotesWeekId === week.id ? null : week.id)}
                        title="Show week notes"
                        aria-label="Show week notes"
                      >
                        ⓘ
                      </button>
                    )}
                  </div>
                </td>
                <td className="week-date">
                  <div className="date-with-info">
                    <span>{formatUnixDate(week.start_at)}</span>
                    <button
                      className="time-info-btn"
                      onClick={() => setExpandedWeekId(expandedWeekId === week.id ? null : week.id)}
                      title="Show time window"
                      aria-label="Show time window"
                    >
                      ⓘ
                    </button>
                  </div>
                  {expandedWeekId === week.id && (
                    <div className="time-window-popup" ref={popupRef}>
                      {formatUnixTime(week.start_at)} – {formatUnixTime(week.end_at)}
                    </div>
                  )}
                </td>
                <td className="segment-name">
                  <a 
                    href={`https://www.strava.com/segments/${week.segment_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="View on Strava"
                  >
                    {week.segment_name || `Segment ${week.segment_id}`}
                  </a>
                </td>
                <td className="required-laps">{week.required_laps}</td>
                <td className="participants-count">
                  {week.participants_count ? week.participants_count : '-'}
                </td>
              </tr>
              {expandedNotesWeekId === week.id && week.notes && (
                <tr className="notes-row">
                  <td colSpan={5}>
                    <div className="week-notes-popup" ref={popupRef}>
                      <NotesDisplay markdown={week.notes} />
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ScheduleTable;
