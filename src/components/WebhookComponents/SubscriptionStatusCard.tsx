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

  /**
   * Calculate time remaining until subscription expires.
   * Returns human-readable duration (e.g., "14 hours", "2 minutes")
   */
  const getTimeUntilExpiry = (): string => {
    if (!subscription.expires_at) return '—';
    try {
      const expiresAt = new Date(subscription.expires_at);
      const now = new Date();
      const diffMs = expiresAt.getTime() - now.getTime();

      if (diffMs <= 0) {
        return 'Expired';
      }

      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${minutes}m`;
    } catch {
      return '—';
    }
  };

  /**
   * Calculate time since last renewal.
   * Shows how long until automatic renewal is triggered (at 22 hours).
   * If renewal just happened, shows "Just now" instead of negative times.
   */
  const getTimeSinceRefresh = (): string => {
    if (!subscription.last_refreshed_at) return '—';
    try {
      const refreshedAt = new Date(subscription.last_refreshed_at);
      const now = new Date();
      const diffMs = now.getTime() - refreshedAt.getTime();

      // Handle edge case: last_refreshed_at is in the future (just created)
      if (diffMs < 0) {
        return 'Just now';
      }

      // Handle edge case: subscription was just created/renewed
      if (diffMs < 60000) { // Less than 1 minute
        return 'Just now';
      }

      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      return `${hours}h ${minutes}m ago`;
    } catch {
      return '—';
    }
  };

  /**
   * Check if subscription is close to expiration (less than 2 hours).
   * Used to show warning state and encourage manual renewal if automatic didn't trigger.
   */
  const isNearExpiry = (): boolean => {
    if (!subscription.expires_at) return false;
    try {
      const expiresAt = new Date(subscription.expires_at);
      const now = new Date();
      const diffMs = expiresAt.getTime() - now.getTime();
      return diffMs > 0 && diffMs < 2 * 60 * 60 * 1000; // Less than 2 hours
    } catch {
      return false;
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
              <div className="info-row">
                <span className="label">Time remaining:</span>
                <span className="value" style={
                  isNearExpiry() ? { color: '#f39c12', fontWeight: 'bold' } : {}
                }>
                  {getTimeUntilExpiry()}
                  {isNearExpiry() && ' ⚠ Expiring soon'}
                </span>
              </div>
              <div className="info-row">
                <span className="label">Last renewed:</span>
                <span className="value">{getTimeSinceRefresh()}</span>
              </div>
              <div className="info-row auto-renewal-info">
                <span className="label">Auto-renewal:</span>
                <span className="value">Renews automatically every ~24 hours</span>
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
              title="Manually renew subscription (normally auto-renews every 6 hours)"
            >
              {loading ? 'Renewing...' : 'Renew Now'}
            </button>
            <button
              className="action-btn danger"
              onClick={handleDisable}
              disabled={loading}
              title="Disable real-time webhook updates from Strava"
            >
              {loading ? 'Processing...' : 'Disable'}
            </button>
          </>
        ) : (
          <button
            className="action-btn primary"
            onClick={handleEnable}
            disabled={loading}
            title="Enable real-time webhook updates from Strava"
          >
            {loading ? 'Processing...' : 'Enable Webhooks'}
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
