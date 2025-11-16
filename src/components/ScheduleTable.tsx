import React from 'react';
import { Week, Season } from '../api';
import { formatUnixDate, formatUnixTime } from '../utils/dateUtils';
import './ScheduleTable.css';

interface Props {
  weeks: Week[];
  season?: Season;
}

const ScheduleTable: React.FC<Props> = ({ weeks, season }) => {
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
            <th>Time Window</th>
          </tr>
        </thead>
        <tbody>
          {sortedWeeks.map(week => (
            <tr key={week.id} className={upcomingWeek?.id === week.id ? 'upcoming' : ''}>
              <td className="week-name">{week.week_name}</td>
              <td className="week-date">{formatUnixDate(week.start_at)}</td>
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
                {formatUnixTime(week.start_at)} – {formatUnixTime(week.end_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ScheduleTable;
