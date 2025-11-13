import React from 'react';
import { Week } from '../api';
import './ScheduleTable.css';

interface Props {
  weeks: Week[];
}

const ScheduleTable: React.FC<Props> = ({ weeks }) => {
  const formatDate = (week: Week) => {
    if (week.date) {
      const date = new Date(week.date);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
    if (week.start_time) {
      const date = new Date(week.start_time);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
    return 'TBD';
  };

  const formatFullDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (time: string) => {
    if (!time) return '—';
    const date = new Date(time);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Sort weeks by date
  const sortedWeeks = [...weeks].sort((a, b) => {
    const dateA = new Date(a.date || a.start_time);
    const dateB = new Date(b.date || b.start_time);
    return dateA.getTime() - dateB.getTime();
  });

  // Get season start and end dates from first and last week
  const seasonStart = sortedWeeks.length > 0 ? formatFullDate(sortedWeeks[0].date || sortedWeeks[0].start_time) : '';
  const seasonEnd = sortedWeeks.length > 0 ? formatFullDate(sortedWeeks[sortedWeeks.length - 1].date || sortedWeeks[sortedWeeks.length - 1].start_time) : '';

  return (
    <div className="schedule-table-container">
      <h2>Season Schedule | {seasonStart} to {seasonEnd}</h2>
      <table className="schedule-table">
        <thead>
          <tr>
            <th>Week</th>
            <th>Date</th>
            <th>Course / Segment</th>
            <th>Laps</th>
            <th>Time Window</th>
          </tr>
        </thead>
        <tbody>
          {sortedWeeks.map(week => (
            <tr key={week.id}>
              <td className="week-name">{week.week_name}</td>
              <td className="week-date">{formatDate(week)}</td>
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
              <td className="time-window">
                {formatTime(week.start_time)} – {formatTime(week.end_time)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ScheduleTable;
