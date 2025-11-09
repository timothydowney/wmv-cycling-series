import { useState } from 'react';
import './AdminPanel.css';
import WeekManager from './WeekManager';
import ParticipantStatus from './ParticipantStatus';

type AdminTab = 'weeks' | 'participants';

function AdminPanel() {
  const [activeTab, setActiveTab] = useState<AdminTab>('weeks');
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h2>Admin Panel</h2>
        <button 
          className="admin-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? '▼ Hide' : '▶ Show'}
        </button>
      </div>

      {isExpanded && (
        <div className="admin-content">
          <div className="admin-tabs">
            <button
              className={`tab-button ${activeTab === 'weeks' ? 'active' : ''}`}
              onClick={() => setActiveTab('weeks')}
            >
              Week Management
            </button>
            <button
              className={`tab-button ${activeTab === 'participants' ? 'active' : ''}`}
              onClick={() => setActiveTab('participants')}
            >
              Participant Status
            </button>
          </div>

          <div className="admin-panel-body">
            {activeTab === 'weeks' && <WeekManager />}
            {activeTab === 'participants' && <ParticipantStatus />}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPanel;
