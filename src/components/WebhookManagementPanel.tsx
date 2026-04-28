import React, { useCallback, useState } from 'react';
import './WebhookManagementPanel.css';
import { trpc } from '../utils/trpc'; // Import trpc

import SubscriptionStatusCard from './WebhookComponents/SubscriptionStatusCard';
import WebhookEventHistory from './WebhookComponents/WebhookEventHistory';

// Interfaces for tRPC query results
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
}

export const WebhookManagementPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'status' | 'events'>('status');

  // tRPC queries
  const { data: subscription, isLoading, error: subscriptionError, refetch: refetchSubscription } =
    trpc.webhookAdmin.getStatus.useQuery(undefined, {
      refetchInterval: 30000, // Auto-refresh every 30 seconds
    });

  const error = subscriptionError?.message || null;

  const handleRefresh = useCallback(async () => {
    refetchSubscription();
  }, [refetchSubscription]);

  if (isLoading) {
    return (
      <div className="webhook-panel">
        <div className="loading">Loading webhook management panel...</div>
      </div>
    );
  }

  return (
    <div className="webhook-panel">
      <div className="webhook-panel-header">
        <div className="webhook-panel-title-block">
          <p className="webhook-panel-eyebrow">Admin observability</p>
          <h2 className="webhook-panel-title">Manage Webhooks</h2>
          <p className="webhook-panel-subtitle">
            Track Strava event flow, confirm competition and Explorer matches, and inspect stored processing outcomes.
          </p>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <p>{error}</p>
        </div>
      )}

      <div className="webhook-tabs" role="tablist" aria-label="Webhook management views">
        <button
          className={`tab-btn ${activeTab === 'status' ? 'active' : ''}`}
          onClick={() => setActiveTab('status')}
          role="tab"
          aria-selected={activeTab === 'status'}
        >
          Subscription Status
        </button>
        <button
          className={`tab-btn ${activeTab === 'events' ? 'active' : ''}`}
          onClick={() => setActiveTab('events')}
          role="tab"
          aria-selected={activeTab === 'events'}
        >
          Event History
        </button>
      </div>

      <div className="webhook-content">
        {activeTab === 'status' && subscription && (
          <SubscriptionStatusCard
            subscription={subscription as SubscriptionStatus} // Cast to correct type
            onStatusUpdate={handleRefresh}
          />
        )}

        {activeTab === 'events' && (
          <WebhookEventHistory />
        )}
      </div>
    </div>
  );
};

export default WebhookManagementPanel;
