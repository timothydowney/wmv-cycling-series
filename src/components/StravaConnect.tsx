import { useState, useEffect } from 'react';
import { getAuthStatus, disconnect, getConnectUrl, AuthStatus } from '../api';
import '../strava-branding.css';
import './StravaConnect.css';

interface StravaConnectProps {
  onAuthChange?: (status: AuthStatus) => void;
}

function StravaConnect({ onAuthChange }: StravaConnectProps) {
  const [authStatus, setAuthStatus] = useState<AuthStatus>({
    authenticated: false,
    participant: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAuthStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('[StravaConnect] Fetching auth status...');
      const status = await getAuthStatus();
      console.log('[StravaConnect] Auth status response:', status);
      setAuthStatus(status);
      onAuthChange?.(status);
    } catch (err) {
      console.error('Failed to fetch auth status:', err);
      setError('Failed to check connection status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuthStatus();

    // Check for OAuth callback success/error in URL params
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'true') {
      // OAuth successful - refresh status
      console.log('[StravaConnect] OAuth callback detected (connected=true), fetching auth status...');
      fetchAuthStatus();
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('error')) {
      const errorType = params.get('error');
      let errorMessage = 'Failed to connect to Strava';
      
      switch (errorType) {
        case 'authorization_denied':
          errorMessage = 'Authorization was denied';
          break;
        case 'token_exchange_failed':
          errorMessage = 'Failed to exchange authorization code';
          break;
        case 'server_error':
          errorMessage = 'Server error during authentication';
          break;
      }
      
      console.log('[StravaConnect] OAuth error detected:', errorType);
      setError(errorMessage);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Strava account?')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await disconnect();
      setAuthStatus({
        authenticated: false,
        participant: null
      });
      onAuthChange?.({
        authenticated: false,
        participant: null
      });
    } catch (err) {
      console.error('Failed to disconnect:', err);
      setError('Failed to disconnect from Strava');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="strava-connect-container">
        <div className="strava-loading">Checking connection...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="strava-connect-container">
        <div className="strava-error">⚠️ {error}</div>
        <button 
          onClick={fetchAuthStatus}
          className="strava-retry-button"
        >
          Retry
        </button>
      </div>
    );
  }

  if (authStatus.authenticated && authStatus.participant) {
    return (
      <div className="strava-connect-container">
        <div className="strava-connected">
          Connected as {authStatus.participant.name}
        </div>
        <button 
          onClick={handleDisconnect}
          className="strava-disconnect-button"
          disabled={loading}
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="strava-connect-container">
      <div className="privacy-notice">
        <p className="privacy-notice-text">
          By connecting your Strava account, you agree to share your activity data with Western Mass Velo for competition tracking purposes. Your data is protected by our <a href="/PRIVACY_POLICY.md" target="_blank" rel="noopener noreferrer" className="privacy-link">Privacy Policy</a>.
        </p>
      </div>
      <a href={getConnectUrl()} className="strava-connect-link">
        <img 
          src="/assets/strava/btn_strava_connectwith_orange.svg"
          alt="Connect with Strava"
          className="strava-connect-button"
        />
      </a>
      <p className="strava-connect-help">
        Connect your Strava account to participate in the weekly competition
      </p>
    </div>
  );
}

export default StravaConnect;
