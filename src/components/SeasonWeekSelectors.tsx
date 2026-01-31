import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Season, Week } from '../types';
import SeasonSelector from './SeasonSelector';
import TimelineWeekSelector from './TimelineWeekSelector';
import './SeasonWeekSelectors.css';

interface Props {
  seasons: Season[];
  selectedSeasonId: number | null;
  weeks: Week[];
  selectedWeekId: number | null;
  showWeekSelector?: boolean;
  activeTab: 'weekly' | 'season' | 'schedule';
}

const SeasonWeekSelectors: React.FC<Props> = ({
  seasons,
  selectedSeasonId,
  weeks,
  selectedWeekId,
  showWeekSelector = true,
  activeTab
}) => {
  const navigate = useNavigate();

  const handleSeasonChange = (id: number) => {
    navigate(`/leaderboard/${id}/${activeTab}`);
  };

  const handleWeekChange = (id: number) => {
    if (selectedSeasonId) {
      navigate(`/leaderboard/${selectedSeasonId}/weekly/${id}`);
    }
  };

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
          setSelectedSeasonId={handleSeasonChange}
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
        setSelectedSeasonId={handleSeasonChange}
      />
      {showWeekSelector && (
        <div style={{ width: '100%', maxWidth: '100%' }}>
          <TimelineWeekSelector
            weeks={weeks}
            selectedWeekId={selectedWeekId}
            setSelectedWeekId={handleWeekChange}
          />
        </div>
      )}
    </div>
  );
};

export default SeasonWeekSelectors;
