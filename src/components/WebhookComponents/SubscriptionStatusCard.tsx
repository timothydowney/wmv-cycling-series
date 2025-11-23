import React, { useState } from 'react';
import { api } from '../../api';
import './SubscriptionStatusCard.css';

interface SubscriptionStatus {
  subscription: {
    id: number;
    strava_subscription_id: number | null;
    enabled: boolean;
    status: 'inactive' | 'pending' | 'active' | 'failed';
    status_message: string | null;
    last_verified_at: string | null;
    failed_attempt_count: number;
    created_at: string;
  };
  events: {
    total: number;
    processed: number;
    failed: number;
    last_event_time: string | null;
  };
}

interface Props {
  subscription: SubscriptionStatus;
  onStatusUpdate: () => Promise<void>;
}

const SubscriptionStatusCard: React.FC<Props> = ({ subscription, onStatusUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active':
        return '#2ecc71';
      case 'pending':
        return '#f39c12';
      case 'failed':
        return '#e74c3c';
      default:
        return '#95a5a6';
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'active':
        return '●';
      case 'pending':
        return '◐';
      case 'failed':
        return '✕';
      default:
        return '○';
    }
  };

  const handleEnable = async () => {
    setLoading(true);
    try {
      await api.enableWebhooks();
      setMessage('Webhooks enabled successfully');
      await onStatusUpdate();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to enable webhooks';
      setMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!window.confirm('Disable webhooks? You can re-enable them later.')) {
      return;
    }
    setLoading(true);
    try {
      await api.disableWebhooks();
      setMessage('Webhooks disabled successfully');
      await onStatusUpdate();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to disable webhooks';
      setMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setLoading(true);
    try {
      await api.verifyWebhooks();
      setMessage('Subscription verified successfully');
      await onStatusUpdate();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to verify subscription';
      setMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const { subscription: sub, events } = subscription;
  const statusColor = getStatusColor(sub.status);
  const statusIcon = getStatusIcon(sub.status);

  const lastVerified = sub.last_verified_at
    ? new Date(sub.last_verified_at).toLocaleString()
    : 'Never';

  const lastEvent = events.last_event_time
    ? new Date(events.last_event_time).toLocaleString()
    : 'No events';

  const successRate =
    events.total > 0
      ? ((events.processed / events.total) * 100).toFixed(1)
      : 'N/A';

  return (
    <div className="subscription-card">
      <div className="card-header">
        <div className="status-indicator" style={{ color: statusColor }}>
          {statusIcon}
          <span>{sub.status.toUpperCase()}</span>
        </div>
        <div className="card-title">Webhook Subscription</div>
      </div>

      <div className="card-body">
        <div className="info-row">
          <label>Current Status:</label>
          <span style={{ color: statusColor, fontWeight: 600 }}>
            {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
          </span>
        </div>

        {sub.status_message && (
          <div className="info-row alert">
            <label>Message:</label>
            <span>{sub.status_message}</span>
          </div>
        )}

        <div className="info-row">
          <label>Subscription ID:</label>
          <span className="mono">
            {sub.strava_subscription_id ? sub.strava_subscription_id : 'Not created yet'}
          </span>
        </div>

        <div className="info-row">
          <label>Last Verified:</label>
          <span>{lastVerified}</span>
        </div>

        <div className="info-row">
          <label>Last Event:</label>
          <span>{lastEvent}</span>
        </div>

        <div className="metrics">
          <div className="metric">
            <div className="metric-label">Events Received</div>
            <div className="metric-value">{events.total}</div>
          </div>
          <div className="metric">
            <div className="metric-label">Processed</div>
            <div className="metric-value">{events.processed}</div>
          </div>
          <div className="metric">
            <div className="metric-label">Failed</div>
            <div className="metric-value" style={{ color: '#e74c3c' }}>
              {events.failed}
            </div>
          </div>
          <div className="metric">
            <div className="metric-label">Success Rate</div>
            <div className="metric-value">{successRate}%</div>
          </div>
        </div>
      </div>

      <div className="card-footer">
        <button
          className="action-btn primary"
          onClick={handleEnable}
          disabled={sub.enabled || loading}
        >
          {loading ? 'Processing...' : 'Enable'}
        </button>
        <button
          className="action-btn danger"
          onClick={handleDisable}
          disabled={!sub.enabled || loading}
        >
          {loading ? 'Processing...' : 'Disable'}
        </button>
        <button
          className="action-btn secondary"
          onClick={handleVerify}
          disabled={loading}
        >
          {loading ? 'Verifying...' : 'Verify Now'}
        </button>
      </div>

      {message && (
        <div className={`status-message ${message.startsWith('Failed') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}
    </div>
  );
};

export default SubscriptionStatusCard;
