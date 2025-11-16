import { useState, useEffect } from 'react';
import './AdminPanel.css';
import WeekManager from './WeekManager';
import { getAuthStatus, Season } from '../api';
import SeasonSelector from './SeasonSelector';

interface AdminPanelProps {
  onFetchResults?: () => void;
  seasons: Season[];
  selectedSeasonId: number | null;
  onSeasonChange: (seasonId: number) => void;
}

function AdminPanel({ onFetchResults, seasons, selectedSeasonId, onSeasonChange }: AdminPanelProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const status = await getAuthStatus();
        setIsAdmin(status.is_admin || false);
      } catch (error) {
        console.error('Failed to check admin status:', error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdmin();
  }, []);

  if (loading) {
    return <div className="admin-panel"><p>Loading...</p></div>;
  }

  if (!isAdmin) {
    return (
      <div className="admin-panel">
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2 style={{ color: '#e74c3c', marginBottom: '1rem' }}>Access Denied</h2>
          <p>You do not have admin permissions to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1>Manage Competition</h1>
        <p className="admin-subtitle">Create weeks, manage segments, and fetch results for the Zwift Hill Climb/Time Trial Series</p>
      </div>

      {seasons.length > 0 && (
        <div className="admin-season-selector-wrapper">
          <SeasonSelector
            seasons={seasons}
            selectedSeasonId={selectedSeasonId}
            setSelectedSeasonId={onSeasonChange}
          />
        </div>
      )}

      {selectedSeasonId && (
        <WeekManager onFetchResults={onFetchResults} seasonId={selectedSeasonId} />
      )}
    </div>
  );
}

export default AdminPanel;
