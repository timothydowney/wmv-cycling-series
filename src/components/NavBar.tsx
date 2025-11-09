import { useState, useEffect } from 'react';
import './NavBar.css';

interface NavBarProps {
  onAdminPanelToggle: () => void;
  isAdminPanelOpen: boolean;
  onParticipantsClick?: () => void;
  onLeaderboardClick?: () => void;
}

interface AthleteInfo {
  id: number;
  firstname: string;
  lastname: string;
  profile?: string;
}

const NavBar: React.FC<NavBarProps> = ({ onAdminPanelToggle, isAdminPanelOpen, onParticipantsClick, onLeaderboardClick }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [athleteInfo, setAthleteInfo] = useState<AthleteInfo | null>(null);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const response = await fetch('http://localhost:3001/auth/status', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setIsConnected(data.authenticated && data.participant?.is_connected);
        
        // Convert participant data to athlete format
        if (data.participant && data.participant.is_connected) {
          const nameParts = data.participant.name.split(' ');
          setAthleteInfo({
            id: data.participant.strava_athlete_id,
            firstname: nameParts[0] || '',
            lastname: nameParts.slice(1).join(' ') || '',
            profile: undefined // We don't have profile photo in our current schema
          });
        } else {
          setAthleteInfo(null);
        }
      }
    } catch (error) {
      console.error('Error checking connection:', error);
      setIsConnected(false);
    }
  };

  const handleConnect = () => {
    window.location.href = 'http://localhost:3001/auth/strava';
  };

  const handleDisconnect = async () => {
    try {
      await fetch('http://localhost:3001/auth/disconnect', {
        method: 'POST',
        credentials: 'include'
      });
      setIsConnected(false);
      setAthleteInfo(null);
      setIsMenuOpen(false);
      window.location.reload();
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleAdminClick = () => {
    onAdminPanelToggle();
    setIsMenuOpen(false);
  };

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <img src="/wmv-logo.png" alt="Western Mass Velo" className="navbar-logo" />
        <h1 className="navbar-title">Zwift Hill Climb/Time Trial Series</h1>
      </div>
      
      <div className="navbar-right">
        {/* Strava Connection Status - Using Strava Orange */}
        <div className="strava-status-icon" title={isConnected ? 'Connected to Strava' : 'Not connected to Strava'}>
          {isConnected ? (
            <svg className="status-icon strava-connected" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="status-icon strava-disconnected" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>

        {/* Hamburger Menu */}
        <button className="menu-button" onClick={toggleMenu} aria-label="Menu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Dropdown Menu */}
        {isMenuOpen && (
          <>
            <div className="menu-overlay" onClick={() => setIsMenuOpen(false)} />
            <div className="dropdown-menu">
              {isConnected && athleteInfo ? (
                <div className="menu-section">
                  <div className="menu-header">
                    {athleteInfo.profile && (
                      <img src={athleteInfo.profile} alt="Profile" className="profile-pic" />
                    )}
                    <div className="profile-info">
                      <div className="profile-name">{athleteInfo.firstname} {athleteInfo.lastname}</div>
                      <div className="profile-status strava-connected-text">Connected to Strava</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="menu-section">
                  <div className="menu-item disabled">
                    <span>Not connected to Strava</span>
                  </div>
                </div>
              )}

              <div className="menu-divider" />

              <div className="menu-section">
                {isConnected ? (
                  <>
                    <button className="menu-item" onClick={() => {
                      if (onLeaderboardClick) onLeaderboardClick();
                      setIsMenuOpen(false);
                    }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="menu-icon">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      View Leaderboard
                    </button>
                    <button className="menu-item" onClick={handleAdminClick}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="menu-icon">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Manage Competition
                    </button>
                    <button className="menu-item" onClick={() => {
                      if (onParticipantsClick) onParticipantsClick();
                      setIsMenuOpen(false);
                    }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="menu-icon">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Participant Status
                    </button>
                    <button className="menu-item danger" onClick={handleDisconnect}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="menu-icon">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Disconnect from Strava
                    </button>
                  </>
                ) : (
                  <button className="menu-item strava-connect-menu-item" onClick={handleConnect}>
                    <img src="/assets/strava/btn_strava_connectwith_orange.svg" alt="Connect with Strava" className="strava-connect-button" />
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </nav>
  );
};

export default NavBar;
