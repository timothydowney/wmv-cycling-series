import React from 'react';
import './BottomNav.css';

export type ExplorerTabType = 'hub' | 'destinations' | 'map';

interface ExplorerBottomNavProps {
  activeTab: ExplorerTabType;
  onSelect: (tab: Exclude<ExplorerTabType, 'map'>) => void;
}

const ExplorerBottomNav: React.FC<ExplorerBottomNavProps> = ({ activeTab, onSelect }) => {
  return (
    <div className="bottom-nav" data-testid="explorer-bottom-nav" aria-label="Explorer views">
      <button
        type="button"
        className={`bottom-nav-item ${activeTab === 'hub' ? 'active' : ''}`}
        data-testid="explorer-tab-hub"
        aria-pressed={activeTab === 'hub'}
        onClick={() => onSelect('hub')}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        <span>Hub</span>
      </button>

      <button
        type="button"
        className={`bottom-nav-item ${activeTab === 'destinations' ? 'active' : ''}`}
        data-testid="explorer-tab-destinations"
        aria-pressed={activeTab === 'destinations'}
        onClick={() => onSelect('destinations')}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"></path>
          <path d="m9 12 2 2 4-4"></path>
        </svg>
        <span>Destinations</span>
      </button>

      <button
        type="button"
        className="bottom-nav-item disabled"
        data-testid="explorer-tab-map"
        aria-disabled="true"
        disabled
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon>
          <line x1="9" y1="3" x2="9" y2="18"></line>
          <line x1="15" y1="6" x2="15" y2="21"></line>
        </svg>
        <span>Map</span>
      </button>
    </div>
  );
};

export default ExplorerBottomNav;
