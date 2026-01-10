import React, { useState } from 'react';
import './StravaClubJoinPrompt.css';

interface StravaClubJoinPromptProps {
  show: boolean;
  onNotInterested: () => void;
  onRemindLater: () => void;
}

const StravaClubJoinPrompt: React.FC<StravaClubJoinPromptProps> = ({
  show,
  onNotInterested,
  onRemindLater,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);

  if (!show || isDismissed) {
    return null;
  }

  const handleNotInterested = () => {
    onNotInterested();
    setIsDismissed(true);
  };

  const handleRemindLater = () => {
    onRemindLater();
    setIsDismissed(true);
  };

  const handleJoinClub = () => {
    window.open('https://www.strava.com/clubs/westernmassvelo', '_blank');
  };

  return (
    <div className="strava-club-prompt">
      <div className="club-prompt-content">
        <div className="club-prompt-text">
          <h3>Join Western Mass Velo Club</h3>
          <p>
            Want to be part of our community? Join the Western Mass Velo club on Strava to connect with fellow cyclists
            and see all club activities.
          </p>
        </div>
        <button className="club-join-button" onClick={handleJoinClub}>
          Join Club on Strava
        </button>
      </div>

      <div className="club-prompt-footer">
        <button className="club-remind-later" onClick={handleRemindLater}>
          Remind me later
        </button>
        <button className="club-not-interested" onClick={handleNotInterested}>
          Not interested
        </button>
      </div>
    </div>
  );
};

export default StravaClubJoinPrompt;
