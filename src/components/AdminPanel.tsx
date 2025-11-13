import { useState, useEffect } from 'react';
import './AdminPanel.css';
import WeekManager from './WeekManager';
import { getAuthStatus } from '../api';

interface AdminPanelProps {
  onFetchResults?: () => void;
}

function AdminPanel({ onFetchResults }: AdminPanelProps) {
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
        <h1>Competition Management</h1>
        <p className="admin-subtitle">Manage weeks, segments, and results for the Zwift Hill Climb/Time Trial Series</p>
      </div>

      <WeekManager onFetchResults={onFetchResults} />
    </div>
  );
}

export default AdminPanel;
