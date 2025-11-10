import React from 'react';
import { Week } from '../api';

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

  return (
    <div>
      <label htmlFor="week-select">Select Week: </label>
      <select
        id="week-select"
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
