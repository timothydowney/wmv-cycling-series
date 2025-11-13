import React from 'react';
import { Week } from '../api';
import './WeekSelector.css';

interface Props {
  weeks: Week[];
  selectedWeekId: number | null;
  setSelectedWeekId: (id: number) => void;
}

const WeekSelector: React.FC<Props> = ({ weeks, selectedWeekId, setSelectedWeekId }) => {
  const formatDate = (week: Week) => {
    // Use date if available (old format), otherwise use start_time
    if (week.date) {
      return week.date;
    }
    if (week.start_time) {
      // Format start_time as just the date (YYYY-MM-DD)
      return new Date(week.start_time).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
    return '';
  };

  if (weeks.length === 0) {
    return (
      <div className="week-selector-empty-container">
        <div className="week-selector-empty-box">
          <p className="week-selector-empty-text">No weeks have been added to the season.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="week-selector-container">
      <label htmlFor="week-select" className="week-selector-label">Select Week:</label>
      <select
        id="week-select"
        className="week-selector-dropdown"
        value={selectedWeekId || ''}
        onChange={(e) => setSelectedWeekId(parseInt(e.target.value))}
      >
        {weeks.map(week => (
          <option key={week.id} value={week.id}>
            {week.week_name} ({formatDate(week)})
          </option>
        ))}
      </select>
    </div>
  );
};

export default WeekSelector;
