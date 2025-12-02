import { useState, useEffect } from 'react';
import './ParticipantStatus.css';
import { getAuthStatus } from '../api';
import { trpc } from '../utils/trpc';
import StravaAthleteBadge from './StravaAthleteBadge';

function ParticipantStatus() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  
  const { data: participants = [], isLoading: loading, error: loadError } = trpc.participant.getAll.useQuery(
    undefined,
    { 
      enabled: isAdmin,
      refetchOnWindowFocus: false 
    }
  );

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const status = await getAuthStatus();
        setIsAdmin(status.is_admin || false);
      } catch (error) {
        console.error('Failed to check admin status:', error);
        setIsAdmin(false);
      } finally {
        setCheckingAuth(false);
      }
    };

    checkAdmin();
  }, []);

  if (checkingAuth) {
    return <div className="participant-status">Loading...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="participant-status">
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2 style={{ color: '#e74c3c', marginBottom: '1rem' }}>Access Denied</h2>
          <p>You do not have admin permissions to access this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="participant-status">Loading participants...</div>;
  }

  if (loadError) {
    return <div className="participant-status error">{loadError.message}</div>;
  }

  const connectedCount = participants.filter((p: any) => p.has_token).length;
  const totalCount = participants.length;

  return (
    <div className="participant-status">
      <div className="status-summary">
        <h3>Connection Status</h3>
        <p>
          <strong>{connectedCount}</strong> of <strong>{totalCount}</strong> participants connected
        </p>
      </div>

      <table className="participants-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Strava Athlete ID</th>
            <th>Status</th>
            <th>Token Expires</th>
          </tr>
        </thead>
        <tbody>
          {participants.map((participant: any) => (
            <tr key={participant.id} className={participant.has_token ? 'connected' : 'disconnected'}>
              <td>
                <StravaAthleteBadge
                  athleteId={participant.strava_athlete_id}
                  name={participant.name}
                  profilePictureUrl={participant.profile_picture_url}
                />
              </td>
              <td>{participant.strava_athlete_id}</td>
              <td>
                <span className={`status-badge ${participant.has_token ? 'connected' : 'disconnected'}`}>
                  {participant.has_token ? '✓ Connected' : '✗ Not Connected'}
                </span>
              </td>
              <td>
                {participant.token_expires_at 
                  ? new Date(parseInt(participant.token_expires_at) * 1000).toLocaleString()
                  : '-'
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="help-text">
        <h4>About Connection Status</h4>
        <p>
          Participants must connect their Strava accounts using the "Connect with Strava" button 
          in the main app before their activities can be fetched.
        </p>
        <p>
          When you click "Fetch Results" for a week, only connected participants will have their 
          activities retrieved and scored.
        </p>
      </div>
    </div>
  );
}

export default ParticipantStatus;
