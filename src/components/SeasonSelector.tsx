import React from 'react';
import { Season } from '../types';
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
      <label htmlFor="season-select" className="season-selector-label">Season:</label>
      <select
        id="season-select"
        className="season-selector-dropdown"
        value={selectedSeasonId || ''}
        onChange={(e) => {
          const seasonId = parseInt(e.target.value);
          console.log(`[SeasonSelector] Season changed to: ${seasonId}`);
          setSelectedSeasonId(seasonId);
        }}
      >
        {seasons.map(season => (
          <option key={season.id} value={season.id}>
            {season.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default SeasonSelector;
