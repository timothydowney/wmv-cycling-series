import React, { useState, useCallback } from 'react';
import './WebhookManagementPanel.css';
import { trpc } from '../utils/trpc'; // Import trpc

import SubscriptionStatusCard from './WebhookComponents/SubscriptionStatusCard';
import WebhookEventHistory from './WebhookComponents/WebhookEventHistory';
import StorageStatusCard from './WebhookComponents/StorageStatusCard';

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

interface StorageStatus {
  database_size_mb: number;
  max_size_mb: number; // Changed from available_space_mb
  usage_percentage: number;
  auto_disable_threshold: number;
  should_auto_disable: boolean;
  warning_message: string | null;
  events_count: number;
  events_per_day: number;
  estimated_weeks_remaining: number;
  last_calculated_at: string;
}

export const WebhookManagementPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'status' | 'events' | 'storage'>('status');

  // tRPC queries
  const { data: subscription, isLoading: isLoadingSubscription, error: subscriptionError, refetch: refetchSubscription } =
    trpc.webhookAdmin.getStatus.useQuery(undefined, {
      refetchInterval: 30000, // Auto-refresh every 30 seconds
    });

  const { data: storage, isLoading: isLoadingStorage, error: storageError, refetch: refetchStorage } =
    trpc.webhookAdmin.getStorageStatus.useQuery(undefined, {
      refetchInterval: 30000, // Auto-refresh every 30 seconds
    });

  const isLoading = isLoadingSubscription || isLoadingStorage;
  const error = subscriptionError?.message || storageError?.message || null;

  const handleRefresh = useCallback(async () => {
    refetchSubscription();
    refetchStorage();
  }, [refetchSubscription, refetchStorage]);

  if (isLoading) {
    return (
      <div className="webhook-panel">
        <div className="loading">Loading webhook management panel...</div>
      </div>
    );
  }

  return (
    <div className="webhook-panel">
      <div className="webhook-header">
        <h2>Webhook Management</h2>
      </div>

      {error && (
        <div className="error-banner">
          <p>{error}</p>
        </div>
      )}

      <div className="webhook-tabs">
        <button
          className={`tab-btn ${activeTab === 'status' ? 'active' : ''}`}
          onClick={() => setActiveTab('status')}
        >
          Subscription Status
        </button>
        <button
          className={`tab-btn ${activeTab === 'events' ? 'active' : ''}`}
          onClick={() => setActiveTab('events')}
        >
          Event History
        </button>
        <button
          className={`tab-btn ${activeTab === 'storage' ? 'active' : ''}`}
          onClick={() => setActiveTab('storage')}
        >
          Storage Usage
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

        {activeTab === 'storage' && storage && (
          <StorageStatusCard storage={storage as StorageStatus} /> // Cast to correct type
        )}
      </div>
    </div>
  );
};

export default WebhookManagementPanel;
