import { useState, useEffect } from 'react';
import './NavBar.css';
import { getAuthStatus, disconnect, getConnectUrl } from '../api';
import { useUnits } from '../context/UnitContext';
import UnitToggle from './UnitToggle';

interface NavBarProps {
  title?: string;
  onAdminPanelToggle: () => void;
  isAdminPanelOpen: boolean;
  onParticipantsClick?: () => void;
  onLeaderboardClick?: () => void;
  onManageSeasonsClick?: () => void;
  onWebhooksClick?: () => void;
  onAboutClick?: () => void;
}

interface AthleteInfo {
  id: number;
  firstname: string;
  lastname: string;
  profile?: string;
}

const NavBar: React.FC<NavBarProps> = ({ title, onAdminPanelToggle, isAdminPanelOpen: _isAdminPanelOpen, onParticipantsClick, onLeaderboardClick, onManageSeasonsClick, onWebhooksClick, onAboutClick }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [athleteInfo, setAthleteInfo] = useState<AthleteInfo | null>(null);
  const { units, setUnits } = useUnits();

  useEffect(() => {
    // Check if we just came back from OAuth callback
    const params = new URLSearchParams(window.location.search);
    if (params.has('connected')) {
      // Connected from OAuth - check status and clean up URL
      checkConnection();
      // Clear the query parameter from URL (replace state, don't reload)
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      // Normal page load - just check connection
      checkConnection();
    }
  }, []);

  const checkConnection = async () => {
    try {
      console.log('[NavBar] Checking auth status...');
      const data = await getAuthStatus();
      console.log('[NavBar] Auth status response:', data);
      
      // User is connected if authenticated AND has participant data
      const isConnected = !!(data.authenticated && data.participant);
      console.log('[NavBar] Setting isConnected to:', isConnected);
      setIsConnected(isConnected);
      setIsAdmin(data.is_admin || false);
      
      // Convert participant data to athlete format
      if (data.participant) {
        const nameParts = data.participant.name.split(' ');
        setAthleteInfo({
          id: data.participant.strava_athlete_id,
          firstname: nameParts[0] || '',
          lastname: nameParts.slice(1).join(' ') || '',
          profile: data.participant.profile_picture_url || undefined
        });
      } else {
        setAthleteInfo(null);
      }
    } catch (error) {
      console.error('[NavBar] Error checking connection:', error);
      setIsConnected(false);
      setIsAdmin(false);
    }
  };

  const handleConnect = () => {
    window.location.href = getConnectUrl();
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
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
        <a href="https://westernmassvelo.com/" target="_blank" rel="noopener noreferrer" className="navbar-home-link" title="Western Mass Velo">
          <img src="/wmv-logo.png" alt="Western Mass Velo" className="navbar-logo" />
        </a>
        <div className="navbar-title-section">
          <h1 className="navbar-title">
            {title ? (
              <span>{title}</span>
            ) : (
              <>
                <span className="desktop-title">Zwift Hill Climb/Time Trial Series</span>
                <span className="mobile-title">Zwift Series</span>
              </>
            )}
          </h1>
          <a href="https://westernmassvelo.com/" target="_blank" rel="noopener noreferrer" className="navbar-org-link">
            Western Mass Velo
          </a>
        </div>
      </div>
      
      <div className="navbar-right">
        {/* Profile Menu Trigger */}
        <button className="profile-menu-button" onClick={toggleMenu} aria-label="Menu">
          {isConnected && athleteInfo ? (
            athleteInfo.profile ? (
              <img src={athleteInfo.profile} alt="Profile" className="navbar-profile-pic" />
            ) : (
              <div className="navbar-profile-initials">
                {athleteInfo.firstname.charAt(0)}{athleteInfo.lastname.charAt(0)}
              </div>
            )
          ) : (
            <div className="navbar-profile-placeholder">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
          )}
        </button>

        {/* Dropdown Menu */}
        {isMenuOpen && (
          <>
            <div className="menu-overlay" onClick={() => setIsMenuOpen(false)} />
            <div className="dropdown-menu">
              {isConnected && athleteInfo ? (
                <div className="menu-section">
                  <div className="menu-header">
                    {athleteInfo.profile ? (
                      <img src={athleteInfo.profile} alt="Profile" className="profile-pic" />
                    ) : (
                      <div className="profile-pic-placeholder">
                        {athleteInfo.firstname.charAt(0)}{athleteInfo.lastname.charAt(0)}
                      </div>
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

              {/* Unit Toggle in Menu */}
              <div className="menu-section">
                <div className="menu-item-custom">
                  <span className="menu-label">Units</span>
                  <UnitToggle units={units} setUnits={setUnits} />
                </div>
              </div>



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
                      Leaderboard
                    </button>
                    
                    {isAdmin && (
                      <>
                        <button className="menu-item" onClick={handleAdminClick}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="menu-icon">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Manage Competition
                        </button>
                        <button className="menu-item" onClick={() => {
                          if (onManageSeasonsClick) onManageSeasonsClick();
                          setIsMenuOpen(false);
                        }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="menu-icon">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M8 7V3m8 4V3m-9 8h10m5 0a2 2 0 01-2 2H4a2 2 0 01-2-2m14-6a2 2 0 011 1.732m-14-1.732a2 2 0 00-1 1.732m14 0a2 2 0 01-2 2m-2-2a2 2 0 01-2-2m2 2a2 2 0 01 2 2v3" />
                          </svg>
                          Manage Seasons
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
                        <button className="menu-item" onClick={() => {
                          if (onWebhooksClick) onWebhooksClick();
                          setIsMenuOpen(false);
                        }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="menu-icon">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          Manage Webhooks
                        </button>
                      </>
                    )}
                    
                    <button className="menu-item" onClick={() => {
                      if (onAboutClick) onAboutClick();
                      setIsMenuOpen(false);
                    }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="menu-icon">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      About
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
                  <>
                    <button className="menu-item" onClick={() => {
                      if (onAboutClick) onAboutClick();
                      setIsMenuOpen(false);
                    }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="menu-icon">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      About
                    </button>
                    <button className="menu-item strava-connect-menu-item" onClick={handleConnect}>
                      <img src="/assets/strava/btn_strava_connectwith_orange.svg" alt="Connect with Strava" className="strava-connect-button" />
                    </button>
                  </>
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
