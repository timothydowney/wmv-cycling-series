import React, { useState } from 'react';
import { api } from '../../api';
import './SubscriptionStatusCard.css';

interface SubscriptionStatus {
  enabled: boolean;
  subscription_id: number | null;
  created_at: string | null;
  expires_at: string | null;
  last_refreshed_at: string | null;
  metrics: {
    total_events: number;
    successful_events: number;
    failed_events: number;
    pending_retries: number;
    events_last_24h: number;
    success_rate: number;
  };
}

interface Props {
  subscription: SubscriptionStatus;
  onStatusUpdate: () => Promise<void>;
}

const SubscriptionStatusCard: React.FC<Props> = ({ subscription, onStatusUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const getStatusIcon = (): string => {
    if (!subscription.enabled) {
      return '✕';
    }
    return '✓';
  };

  const getStatusColor = (): string => {
    if (!subscription.enabled) {
      return '#95a5a6';
    }
    return '#27ae60';
  };

  const getStatusLabel = (): string => {
    if (!subscription.enabled) {
      return 'Webhooks Inactive';
    }
    return 'Webhooks Active';
  };

  const formatDateTime = (isoString: string | null): string => {
    if (!isoString) return '—';
    try {
      const date = new Date(isoString);
      const month = date.toLocaleString('en-US', { month: 'short' });
      const day = date.getDate();
      const year = date.getFullYear();
      const hour = String(date.getHours()).padStart(2, '0');
      const minute = String(date.getMinutes()).padStart(2, '0');
      return `${month} ${day}, ${year} at ${hour}:${minute}`;
    } catch {
      return '—';
    }
  };

  const isExpired = (): boolean => {
    if (!subscription.expires_at) return false;
    try {
      return new Date() > new Date(subscription.expires_at);
    } catch {
      return false;
    }
  };

  const handleEnable = async () => {
    setLoading(true);
    try {
      await api.enableWebhooks();
      setMessage('✓ Webhooks enabled');
      await onStatusUpdate();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to enable webhooks';
      setMessage(`✕ ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    setLoading(true);
    try {
      await api.disableWebhooks();
      setMessage('✓ Webhooks disabled');
      await onStatusUpdate();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to disable webhooks';
      setMessage(`✕ ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRenew = async () => {
    setLoading(true);
    try {
      await api.renewWebhooks();
      setMessage('✓ Subscription renewed');
      await onStatusUpdate();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to renew subscription';
      setMessage(`✕ ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const statusIcon = getStatusIcon();
  const statusColor = getStatusColor();
  const statusLabel = getStatusLabel();

  return (
    <div className="subscription-card">
      {/* Header with status */}
      <div className="card-header" style={{ background: `linear-gradient(135deg, ${statusColor} 0%, ${statusColor}dd 100%)` }}>
        <span className="status-icon" style={{ color: 'white', fontSize: '20px' }}>{statusIcon}</span>
        <span className="status-label" style={{ color: 'white' }}>{statusLabel}</span>
      </div>

      {/* Main content section */}
      <div className="card-body">
        {subscription.enabled ? (
          <>
            <div className="subscription-info">
              <div className="info-row">
                <span className="label">Subscribed since:</span>
                <span className="value">{formatDateTime(subscription.created_at)}</span>
              </div>
              <div className="info-row">
                <span className="label">Expires:</span>
                <span className="value" style={isExpired() ? { color: '#e74c3c', fontWeight: 'bold' } : {}}>
                  {formatDateTime(subscription.expires_at)}
                  {isExpired() && ' (expired - renew to reactivate)'}
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="subscription-info">
            <p className="inactive-message">Enable real-time activity updates from Strava</p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="card-footer">
        {subscription.enabled ? (
          <>
            <button
              className="action-btn primary"
              onClick={handleRenew}
              disabled={loading}
            >
              {loading ? 'Renewing...' : 'Renew'}
            </button>
            <button
              className="action-btn danger"
              onClick={handleDisable}
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Disable'}
            </button>
          </>
        ) : (
          <button
            className="action-btn primary"
            onClick={handleEnable}
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Enable'}
          </button>
        )}
      </div>

      {/* Status message */}
      {message && (
        <div className={`status-message ${message.startsWith('✕') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}
    </div>
  );
};

export default SubscriptionStatusCard;
