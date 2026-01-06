import React from 'react';
import { NavLink, useParams } from 'react-router-dom';
import './BottomNav.css';

export type TabType = 'weekly' | 'season' | 'schedule';

interface BottomNavProps {
  activeTab: TabType;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab }) => {
  const { seasonId, weekId } = useParams();
  
  // Base path for the current season
  const seasonPath = `/leaderboard/${seasonId}`;

  return (
    <div className="bottom-nav">
      <NavLink 
        to={weekId ? `${seasonPath}/weekly/${weekId}` : `${seasonPath}/weekly`}
        className={({ isActive }) => `bottom-nav-item ${isActive || activeTab === 'weekly' ? 'active' : ''}`}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        <span>Weekly</span>
      </NavLink>
      
      <NavLink 
        to={`${seasonPath}/season`}
        className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
          <path d="M4 22h16"></path>
          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
        </svg>
        <span>Season</span>
      </NavLink>
      
      <NavLink 
        to={`${seasonPath}/schedule`}
        className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
          <path d="M8 14h.01"></path>
          <path d="M12 14h.01"></path>
          <path d="M16 14h.01"></path>
          <path d="M8 18h.01"></path>
          <path d="M12 18h.01"></path>
          <path d="M16 18h.01"></path>
        </svg>
        <span>Schedule</span>
      </NavLink>
    </div>
  );
};

export default BottomNav;
