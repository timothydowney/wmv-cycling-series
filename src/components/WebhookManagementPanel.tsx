import React, { useState, useEffect, useCallback } from 'react';
import './WebhookManagementPanel.css';
import { api } from '../api';

import SubscriptionStatusCard from './WebhookComponents/SubscriptionStatusCard';
import WebhookEventHistory from './WebhookComponents/WebhookEventHistory';
import StorageStatusCard from './WebhookComponents/StorageStatusCard';

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

export const WebhookManagementPanel: React.FC = () => {
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [storage, setStorage] = useState<StorageStatus | null>(null);
  const [activeTab, setActiveTab] = useState<'status' | 'events' | 'storage'>('status');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  const fetchSubscriptionStatus = useCallback(async () => {
    try {
      const response = await api.getWebhookStatus();
      setSubscription(response);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch subscription status';
      setError(message);
      console.error('Failed to fetch subscription status:', err);
    }
  }, []);

  const fetchStorageStatus = useCallback(async () => {
    try {
      const response = await api.getWebhookStorageStatus();
      setStorage(response);
    } catch (err) {
      console.error('Failed to fetch storage status:', err);
    }
  }, []);



  const handleRefresh = useCallback(async () => {
    await fetchSubscriptionStatus();
    await fetchStorageStatus();
  }, [fetchSubscriptionStatus, fetchStorageStatus]);

  useEffect(() => {
    const initLoad = async () => {
      setLoading(true);
      try {
        await handleRefresh();
      } finally {
        setLoading(false);
      }
    };

    initLoad();
  }, [handleRefresh]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(handleRefresh, 30000);
    return () => clearInterval(interval);
  }, [handleRefresh]);

  if (loading) {
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
            subscription={subscription}
            onStatusUpdate={fetchSubscriptionStatus}
          />
        )}

        {activeTab === 'events' && (
          <WebhookEventHistory />
        )}

        {activeTab === 'storage' && storage && (
          <StorageStatusCard storage={storage} />
        )}
      </div>
    </div>
  );
};

export default WebhookManagementPanel;
