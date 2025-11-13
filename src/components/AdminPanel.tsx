import './AdminPanel.css';
import WeekManager from './WeekManager';

interface AdminPanelProps {
  onFetchResults?: () => void;
}

function AdminPanel({ onFetchResults }: AdminPanelProps) {
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
