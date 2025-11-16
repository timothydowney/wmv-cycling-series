import React from 'react';
import { Week } from '../api';
import { formatUnixDateShort } from '../utils/dateUtils';
import './WeekSelector.css';

interface Props {
  weeks: Week[];
  selectedWeekId: number | null;
  setSelectedWeekId: (id: number) => void;
}

const WeekSelector: React.FC<Props> = ({ weeks, selectedWeekId, setSelectedWeekId }) => {

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
            {week.week_name} ({formatUnixDateShort(week.start_at)})
          </option>
        ))}
      </select>
    </div>
  );
};

export default WeekSelector;
