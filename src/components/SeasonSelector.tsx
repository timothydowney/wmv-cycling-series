import React from 'react';
import { Season } from '../types';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
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

  const selectedSeason = seasons.find(s => s.id === selectedSeasonId) || seasons[0];

  return (
    <div className="season-selector-card" data-testid="season-selector-card">
      <div className="season-info">
        <span className="season-label">SEASON</span>
        <h2 className="season-name">{selectedSeason?.name}</h2>
      </div>
      
      <div className="season-icon">
        <ChevronDownIcon className="w-6 h-6 text-gray-400" />
      </div>

      <select
        id="season-select"
        className="season-select-overlay"
        data-testid="season-select"
        value={selectedSeasonId || ''}
        onChange={(e) => {
          const seasonId = parseInt(e.target.value);
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
