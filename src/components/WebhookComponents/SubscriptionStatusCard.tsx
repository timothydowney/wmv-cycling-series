import React, { useState } from 'react';
import { trpc } from '../../utils/trpc'; // Import trpc
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
    events_last24h: number; // Changed from events_last_24h to match tRPC output
    success_rate: number;
  };
  diagnostics: {
    delivery_health: 'healthy' | 'warning' | 'degraded' | 'broken';
    config: {
      webhook_enabled: boolean;
      persist_events: boolean;
    };
    last_receipt_at: string | null;
    last_success_at: string | null;
    last_failure_at: string | null;
    last_failure_error: string | null;
    warnings: Array<{
      code: string;
      severity: 'warning' | 'degraded' | 'broken';
      message: string;
    }>;
  };
}

interface Props {
  subscription: SubscriptionStatus;
  onStatusUpdate: () => Promise<void>;
}

const SubscriptionStatusCard: React.FC<Props> = ({ subscription, onStatusUpdate }) => {
  // tRPC Mutations
  const enableMutation = trpc.webhookAdmin.enable.useMutation({
    onSuccess: () => {
      setMessage('✓ Webhooks enabled');
      onStatusUpdate();
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (err) => {
      setMessage(`✕ ${err.message}`);
    }
  });

  const disableMutation = trpc.webhookAdmin.disable.useMutation({
    onSuccess: () => {
      setMessage('✓ Webhooks disabled');
      onStatusUpdate();
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (err) => {
      setMessage(`✕ ${err.message}`);
    }
  });

  const renewMutation = trpc.webhookAdmin.renew.useMutation({
    onSuccess: () => {
      setMessage('✓ Subscription renewed');
      onStatusUpdate();
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (err) => {
      setMessage(`✕ ${err.message}`);
    }
  });

  const [message, setMessage] = useState<string | null>(null);

  const loading = enableMutation.isPending || disableMutation.isPending || renewMutation.isPending;

  const getStatusIcon = (): string => {
    if (subscription.diagnostics.delivery_health === 'broken') {
      return '✕';
    }
    if (subscription.diagnostics.delivery_health === 'degraded') {
      return '!';
    }
    if (subscription.diagnostics.delivery_health === 'warning' || !subscription.enabled) {
      return '⚠';
    }
    if (!subscription.enabled) {
      return '✕';
    }
    return '✓';
  };

  const getStatusColor = (): string => {
    if (subscription.diagnostics.delivery_health === 'broken') {
      return '#c0392b';
    }
    if (subscription.diagnostics.delivery_health === 'degraded') {
      return '#d35400';
    }
    if (subscription.diagnostics.delivery_health === 'warning' || !subscription.enabled) {
      return '#b7950b';
    }
    if (!subscription.enabled) {
      return '#95a5a6';
    }
    return '#27ae60';
  };

  const getStatusLabel = (): string => {
    if (subscription.diagnostics.delivery_health === 'broken') {
      return 'Delivery Broken';
    }
    if (subscription.diagnostics.delivery_health === 'degraded') {
      return 'Delivery Degraded';
    }
    if (subscription.diagnostics.delivery_health === 'warning') {
      return 'Needs Attention';
    }
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

  const handleEnable = () => {
    enableMutation.mutate();
  };

  const handleDisable = () => {
    disableMutation.mutate();
  };

  const handleRenew = () => {
    renewMutation.mutate();
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
                <span className="value">Checks every 6h; renews after ~22h since last refresh</span>
              </div>
              <div className="info-row">
                <span className="label">Last receipt:</span>
                <span className="value">{formatDateTime(subscription.diagnostics.last_receipt_at)}</span>
              </div>
              <div className="info-row">
                <span className="label">Last success:</span>
                <span className="value">{formatDateTime(subscription.diagnostics.last_success_at)}</span>
              </div>
              <div className="info-row">
                <span className="label">Last failure:</span>
                <span className="value">{formatDateTime(subscription.diagnostics.last_failure_at)}</span>
              </div>
              {subscription.diagnostics.last_failure_error && (
                <div className="diagnostic-error">
                  <strong>Latest error:</strong> {subscription.diagnostics.last_failure_error}
                </div>
              )}
              <div className="metrics-grid">
                <div className="metric-chip">
                  <span className="metric-label">24h receipts</span>
                  <span className="metric-value">{subscription.metrics.events_last24h}</span>
                </div>
                <div className="metric-chip">
                  <span className="metric-label">Success rate</span>
                  <span className="metric-value">{subscription.metrics.success_rate}%</span>
                </div>
                <div className="metric-chip">
                  <span className="metric-label">Failures</span>
                  <span className="metric-value">{subscription.metrics.failed_events}</span>
                </div>
              </div>
              {subscription.diagnostics.warnings.length > 0 && (
                <div className="diagnostics-warnings">
                  <p className="diagnostics-title">Troubleshooting warnings</p>
                  {subscription.diagnostics.warnings.map((warning) => (
                    <div key={warning.code} className={`diagnostic-warning ${warning.severity}`}>
                      {warning.message}
                    </div>
                  ))}
                </div>
              )}
              <div className="diagnostics-checklist">
                <p className="diagnostics-title">Quick checks</p>
                <p>1. Confirm Strava dashboard shows recent delivery attempts.</p>
                <p>2. Use Renew Now to force a fresh subscription sync.</p>
                <p>3. Review Event History for newest receipt and error details.</p>
                <p>
                  4. Verify runtime flags: WEBHOOK_ENABLED={String(subscription.diagnostics.config.webhook_enabled)};
                  WEBHOOK_PERSIST_EVENTS={String(subscription.diagnostics.config.persist_events)}.
                </p>
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
              title="Manually renew subscription (scheduler checks every 6 hours, renews near 22 hours)"
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
