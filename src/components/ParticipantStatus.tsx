import { useState, useEffect } from 'react';
import './ParticipantStatus.css';
import { getAdminParticipants } from '../api';

interface Participant {
  id: number;
  name: string;
  strava_athlete_id: number;
  is_connected: number;
  has_token: boolean;
  token_expires_at?: string;
}

function ParticipantStatus() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchParticipants();
  }, []);

  const fetchParticipants = async () => {
    try {
      setLoading(true);
      const data = await getAdminParticipants();
      setParticipants(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="participant-status">Loading participants...</div>;
  }

  if (error) {
    return <div className="participant-status error">{error}</div>;
  }

  const connectedCount = participants.filter(p => p.has_token).length;
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
          {participants.map(participant => (
            <tr key={participant.id} className={participant.has_token ? 'connected' : 'disconnected'}>
              <td>{participant.name}</td>
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
