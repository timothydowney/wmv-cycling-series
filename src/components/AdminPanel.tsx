import './AdminPanel.css';
import WeekManager from './WeekManager';

function AdminPanel() {
  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1>Competition Management</h1>
        <p className="admin-subtitle">Manage weeks, segments, and results for the Zwift Hill Climb/Time Trial Series</p>
      </div>

      <WeekManager />
    </div>
  );
}

export default AdminPanel;
