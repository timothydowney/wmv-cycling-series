import React, { useState } from 'react';
import './StravaConnectInfoBox.css';
import { getConnectUrl } from '../api';

interface StravaConnectInfoBoxProps {
  show: boolean;
}

const StravaConnectInfoBox: React.FC<StravaConnectInfoBoxProps> = ({ show }) => {
  const [isDismissed, setIsDismissed] = useState(false);

  if (!show || isDismissed) {
    return null;
  }

  const handleConnect = () => {
    window.location.href = getConnectUrl();
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  return (
    <div className="strava-connect-infobox" data-testid="strava-connect-banner">
      <div className="infobox-content">
        <div className="infobox-text">
          <h3 data-testid="banner-heading">Want to see your results?  Logged out?</h3>
          <p data-testid="banner-description">Sign in with your Strava account to view your results on the leaderboard and track your performance throughout the season.</p>
        </div>
        <button className="strava-connect-button-infobox" onClick={handleConnect} data-testid="connect-with-strava-button">
          <img src="/assets/strava/btn_strava_connectwith_orange.svg" alt="Connect with Strava" />
        </button>
      </div>
      <button className="infobox-dismiss" onClick={handleDismiss} aria-label="Dismiss" data-testid="dismiss-banner-button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

export default StravaConnectInfoBox;
