import React from 'react';
import { Season } from '../api';
import './SeasonSelector.css';

interface Props {
  seasons: Season[];
  selectedSeasonId: number | null;
  setSelectedSeasonId: (id: number) => void;
}

const SeasonSelector: React.FC<Props> = ({ seasons, selectedSeasonId, setSelectedSeasonId }) => {
  if (seasons.length === 0) {
    return (
      <div className="season-selector-empty-container">
        <div className="season-selector-empty-box">
          <p className="season-selector-empty-text">No seasons have been added.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="season-selector-container">
      <label htmlFor="season-select" className="season-selector-label">Select Season:</label>
      <select
        id="season-select"
        className="season-selector-dropdown"
        value={selectedSeasonId || ''}
        onChange={(e) => setSelectedSeasonId(parseInt(e.target.value))}
      >
        {seasons.map(season => (
          <option key={season.id} value={season.id}>
            {season.name} ({new Date(season.start_date).getFullYear()})
          </option>
        ))}
      </select>
    </div>
  );
};

export default SeasonSelector;
