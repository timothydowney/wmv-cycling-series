import React from 'react';
import './RaceDayBanner.css';

interface RaceDayBannerProps {
  message: string;
}

export const RaceDayBanner: React.FC<RaceDayBannerProps> = ({ message }) => {
  return (
    <div className="race-day-banner">
      <div className="race-day-flag left">
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 58V6" stroke="#888" strokeWidth="4" strokeLinecap="round" />
          <g filter="drop-shadow(2px 2px 2px rgba(0,0,0,0.1))">
            <path d="M12 8H56V40H12V8Z" fill="white" stroke="#333" strokeWidth="1.5" />
            <rect x="12" y="8" width="11" height="8" fill="#333" />
            <rect x="34" y="8" width="11" height="8" fill="#333" />
            <rect x="23" y="16" width="11" height="8" fill="#333" />
            <rect x="45" y="16" width="11" height="8" fill="#333" />
            <rect x="12" y="24" width="11" height="8" fill="#333" />
            <rect x="34" y="24" width="11" height="8" fill="#333" />
            <rect x="23" y="32" width="11" height="8" fill="#333" />
            <rect x="45" y="32" width="11" height="8" fill="#333" />
          </g>
        </svg>
      </div>
      <div className="race-day-banner-content">
        {message}
      </div>
      <div className="race-day-flag right">
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 58V6" stroke="#888" strokeWidth="4" strokeLinecap="round" />
          <g filter="drop-shadow(2px 2px 2px rgba(0,0,0,0.1))">
            <path d="M12 8H56V40H12V8Z" fill="white" stroke="#333" strokeWidth="1.5" />
            <rect x="12" y="8" width="11" height="8" fill="#333" />
            <rect x="34" y="8" width="11" height="8" fill="#333" />
            <rect x="23" y="16" width="11" height="8" fill="#333" />
            <rect x="45" y="16" width="11" height="8" fill="#333" />
            <rect x="12" y="24" width="11" height="8" fill="#333" />
            <rect x="34" y="24" width="11" height="8" fill="#333" />
            <rect x="23" y="32" width="11" height="8" fill="#333" />
            <rect x="45" y="32" width="11" height="8" fill="#333" />
          </g>
        </svg>
      </div>
    </div>
  );
};
