import React from 'react';
import { Season, Week } from '../types';
import SeasonSelector from './SeasonSelector';
import WeekSelector from './WeekSelector';
import './SeasonWeekSelectors.css';

interface Props {
  seasons: Season[];
  selectedSeasonId: number | null;
  setSelectedSeasonId: (id: number) => void;
  weeks: Week[];
  selectedWeekId: number | null;
  setSelectedWeekId: (id: number) => void;
}

const SeasonWeekSelectors: React.FC<Props> = ({
  seasons,
  selectedSeasonId,
  setSelectedSeasonId,
  weeks,
  selectedWeekId,
  setSelectedWeekId
}) => {
  // Show empty state if no seasons
  if (seasons.length === 0) {
    return (
      <div className="season-selector-empty-container">
        <div className="season-selector-empty-box">
          <p className="season-selector-empty-text">No seasons have been added.</p>
        </div>
      </div>
    );
  }

  // Show empty state if no weeks
  if (weeks.length === 0) {
    return (
      <div className="selectors-container">
        <SeasonSelector
          seasons={seasons}
          selectedSeasonId={selectedSeasonId}
          setSelectedSeasonId={setSelectedSeasonId}
        />
        <div className="week-selector-empty-container">
          <div className="week-selector-empty-box">
            <p className="week-selector-empty-text">No weeks have been added to the season.</p>
          </div>
        </div>
      </div>
    );
  }

  // Both selectors visible
  return (
    <div className="selectors-container">
      <SeasonSelector
        seasons={seasons}
        selectedSeasonId={selectedSeasonId}
        setSelectedSeasonId={setSelectedSeasonId}
      />
      <WeekSelector
        weeks={weeks}
        selectedWeekId={selectedWeekId}
        setSelectedWeekId={setSelectedWeekId}
      />
    </div>
  );
};

export default SeasonWeekSelectors;
