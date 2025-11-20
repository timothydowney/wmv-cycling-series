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
    <div className="strava-connect-infobox">
      <div className="infobox-content">
        <div className="infobox-text">
          <h3>Want to see your results?</h3>
          <p>Connect your Strava account to see your own results on the leaderboard and track your performance throughout the season.</p>
        </div>
        <button className="strava-connect-button-infobox" onClick={handleConnect}>
          <img src="/assets/strava/btn_strava_connectwith_orange.svg" alt="Connect with Strava" />
        </button>
      </div>
      <button className="infobox-dismiss" onClick={handleDismiss} aria-label="Dismiss">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

export default StravaConnectInfoBox;
