import React from 'react';
import { Week } from '../api';

interface Props {
  weeks: Week[];
  selectedWeekId: number | null;
  setSelectedWeekId: (id: number) => void;
}

const WeekSelector: React.FC<Props> = ({ weeks, selectedWeekId, setSelectedWeekId }) => {
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
            {week.week_name} ({week.date})
          </option>
        ))}
      </select>
    </div>
  );
};

export default WeekSelector;
