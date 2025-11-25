import React from 'react';
import './StorageStatusCard.css';

interface StorageStatus {
  database_size_mb: number;
  max_size_mb: number;
  usage_percentage: number;
  auto_disable_threshold: number;
  should_auto_disable: boolean;
  events_count: number;
  events_per_day: number;
  estimated_weeks_remaining: number;
  last_calculated_at: string;
  warning_message: string | null;
}

interface StorageStatusCardProps {
  storage: StorageStatus | null;
}

export const StorageStatusCard: React.FC<StorageStatusCardProps> = ({ storage }) => {
  if (!storage) {
    return <div className="storage-card loading">Loading storage information...</div>;
  }

  const getUsageColor = (percentage: number): string => {
    if (percentage >= 95) return 'critical';
    if (percentage >= 80) return 'warning';
    return 'normal';
  };

  const usageColor = getUsageColor(storage.usage_percentage);
  const lastCalc = new Date(storage.last_calculated_at);
  const lastCalcTime = lastCalc.toLocaleString();

  return (
    <div className="storage-card">
      <div className="card-header">
        <h3>Database Storage Status</h3>
        <span className={`status-badge ${usageColor}`}>
          {storage.usage_percentage}% Used
        </span>
      </div>

      {/* Usage Bar */}
      <div className="usage-section">
        <div className="usage-bar-container">
          <div 
            className={`usage-bar ${usageColor}`}
            style={{ width: `${Math.min(storage.usage_percentage, 100)}%` }}
          />
        </div>
        <div className="usage-labels">
          <span>Database: {storage.database_size_mb.toFixed(2)} MB</span>
          <span>Max: {storage.max_size_mb} MB</span>
        </div>
      </div>

      {/* Thresholds Info */}
      <div className="thresholds-section">
        <div className="threshold-item">
          <span className="label">Auto-disable Threshold:</span>
          <span className="value">{storage.auto_disable_threshold}%</span>
        </div>
        <div className="threshold-item">
          <span className="label">Current Status:</span>
          <span className={`value ${storage.should_auto_disable ? 'critical' : 'normal'}`}>
            {storage.should_auto_disable ? 'Webhooks Auto-Disabled' : 'Webhooks Active'}
          </span>
        </div>
      </div>

      {/* Event Statistics */}
      <div className="stats-section">
        <h4>Event Statistics</h4>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-value">{storage.events_count.toLocaleString()}</span>
            <span className="stat-label">Total Events</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{storage.events_per_day.toFixed(1)}</span>
            <span className="stat-label">Events/Day</span>
          </div>
          <div className="stat-item">
            <span className={`stat-value ${storage.estimated_weeks_remaining < 4 ? 'warning' : ''}`}>
              ~{storage.estimated_weeks_remaining}w
            </span>
            <span className="stat-label">Est. Space Remaining</span>
          </div>
        </div>
      </div>

      {/* Warnings */}
      {storage.warning_message && (
        <div className={`warning-alert ${usageColor}`}>
          <span className="warning-icon">⚠️</span>
          <span>{storage.warning_message}</span>
        </div>
      )}

      {storage.should_auto_disable && (
        <div className="warning-alert critical">
          <span className="warning-icon">🚨</span>
          <span>
            Webhooks have been automatically disabled due to insufficient storage. 
            Please delete old events or upgrade storage.
          </span>
        </div>
      )}

      {storage.estimated_weeks_remaining < 4 && !storage.should_auto_disable && (
        <div className="warning-alert warning">
          <span className="warning-icon">⚠️</span>
          <span>
            Storage capacity will be exceeded in approximately {storage.estimated_weeks_remaining} weeks 
            at current event rate. Consider clearing old events.
          </span>
        </div>
      )}

      {/* Last Updated */}
      <div className="meta-info">
        Last calculated: {lastCalcTime}
      </div>
    </div>
  );
};

export default StorageStatusCard;
