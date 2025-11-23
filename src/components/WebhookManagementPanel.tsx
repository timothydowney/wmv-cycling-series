import React, { useState, useEffect } from 'react';
import './WebhookManagementPanel.css';
import { api } from '../api';
import SubscriptionStatusCard from './WebhookComponents/SubscriptionStatusCard';
import WebhookEventHistory from './WebhookComponents/WebhookEventHistory';
import StorageStatusCard from './WebhookComponents/StorageStatusCard';

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

interface StorageStatus {
  database_size_mb: number;
  available_space_mb: number;
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
  const [refreshing, setRefreshing] = useState(false);

  const fetchSubscriptionStatus = async () => {
    try {
      setRefreshing(true);
      const response = await api.getWebhookStatus();
      setSubscription(response);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch subscription status';
      setError(message);
      console.error('Failed to fetch subscription status:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const fetchStorageStatus = async () => {
    try {
      const response = await api.getWebhookStorageStatus();
      setStorage(response);
    } catch (err) {
      console.error('Failed to fetch storage status:', err);
    }
  };

  const handleRefresh = async () => {
    await fetchSubscriptionStatus();
    await fetchStorageStatus();
  };

  useEffect(() => {
    const initLoad = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchSubscriptionStatus(), fetchStorageStatus()]);
      } finally {
        setLoading(false);
      }
    };

    initLoad();
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(handleRefresh, 30000);
    return () => clearInterval(interval);
  }, []);

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
        <button
          className="refresh-btn"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
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
          <WebhookEventHistory onEventRetry={fetchSubscriptionStatus} />
        )}

        {activeTab === 'storage' && storage && (
          <StorageStatusCard storage={storage} />
        )}
      </div>
    </div>
  );
};

export default WebhookManagementPanel;
