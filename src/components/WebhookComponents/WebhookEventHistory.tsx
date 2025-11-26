import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';
import './WebhookEventHistory.css';

interface WebhookPayload {
  aspect_type: 'create' | 'update' | 'delete';
  event_time: number;
  object_id: number;
  object_type: 'activity' | 'athlete';
  owner_id: number;
  subscription_id: number;
  updates?: Record<string, unknown>;
}

interface WebhookEvent {
  id: number;
  created_at: string;
  payload: WebhookPayload;
  processed: boolean;
  error_message: string | null;
}

interface WebhookEventsResponse {
  events: WebhookEvent[];
  total: number;
  limit: number;
  offset: number;
}

interface Props {
  // No props required for now
}

const WebhookEventHistory: React.FC<Props> = () => {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ total: 0, limit: 50, offset: 0, has_more: false });
  const [filters, setFilters] = useState({ status: 'all', since: 604800 });
  const [message, setMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<Record<number, 'raw' | 'formatted'>>({});

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response: WebhookEventsResponse = await api.getWebhookEvents(
        pagination.limit,
        pagination.offset,
        filters.since
      );
      setEvents(response.events);
      setPagination({
        total: response.total,
        limit: response.limit,
        offset: response.offset,
        has_more: response.offset + response.limit < response.total
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch events';
      setError(msg);
      console.error('Failed to fetch webhook events:', err);
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, pagination.offset, filters.since]);

  const handleClearAll = useCallback(async () => {
    if (!window.confirm(`Clear all ${pagination.total} webhook events? This cannot be undone.`)) {
      return;
    }
    setLoading(true);
    try {
      await api.clearWebhookEvents();
      setMessage('All events cleared successfully');
      await fetchEvents();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to clear events';
      setMessage(msg);
    } finally {
      setLoading(false);
    }
  }, [pagination.total, fetchEvents]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const toggleViewMode = (eventId: number) => {
    setViewMode((prev) => ({
      ...prev,
      [eventId]: prev[eventId] === 'raw' ? 'formatted' : 'raw'
    }));
  };

  const getAspectTypeIcon = (aspectType: string): string => {
    switch (aspectType) {
      case 'create':
        return '➕';
      case 'update':
        return '♻️';
      case 'delete':
        return '🗑️';
      default:
        return '📌';
    }
  };

  const getObjectTypeIcon = (objectType: string): string => {
    switch (objectType) {
      case 'activity':
        return '🚴';
      case 'athlete':
        return '👤';
      default:
        return '📦';
    }
  };

  const formatPayloadForDisplay = (payload: WebhookPayload): React.ReactNode => {
    return (
      <div className="payload-formatted">
        <div className="payload-row">
          <span className="label">Aspect:</span>
          <span className="value">{getAspectTypeIcon(payload.aspect_type)} {payload.aspect_type}</span>
        </div>
        <div className="payload-row">
          <span className="label">Object:</span>
          <span className="value">{getObjectTypeIcon(payload.object_type)} {payload.object_type}</span>
        </div>
        <div className="payload-row">
          <span className="label">Object ID:</span>
          <span className="value">{payload.object_id}</span>
        </div>
        <div className="payload-row">
          <span className="label">Owner ID:</span>
          <span className="value">{payload.owner_id}</span>
        </div>
        <div className="payload-row">
          <span className="label">Event Time:</span>
          <span className="value">{new Date(payload.event_time * 1000).toLocaleString()}</span>
        </div>
        {payload.updates && Object.keys(payload.updates).length > 0 && (
          <div className="payload-row">
            <span className="label">Updates:</span>
            <span className="value">{Object.keys(payload.updates).join(', ')}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="event-history">
      <div className="event-filters">
        <div className="filter-group">
          <label htmlFor="status-filter">Status:</label>
          <select
            id="status-filter"
            value={filters.status}
            onChange={(e) => {
              setFilters({ ...filters, status: e.target.value });
              setPagination({ ...pagination, offset: 0 });
            }}
          >
            <option value="all">All Statuses</option>
            <option value="success">Processed</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="time-filter">Time Range:</label>
          <select
            id="time-filter"
            value={filters.since}
            onChange={(e) => {
              setFilters({ ...filters, since: parseInt(e.target.value) });
              setPagination({ ...pagination, offset: 0 });
            }}
          >
            <option value={86400}>Last 24 hours</option>
            <option value={604800}>Last 7 days</option>
            <option value={2592000}>Last 30 days</option>
            <option value={999999999}>All time</option>
          </select>
        </div>

        <button className="clear-btn" onClick={handleClearAll} disabled={loading || pagination.total === 0}>
          Clear All Events
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {message && <div className="success-message">{message}</div>}

      {loading ? (
        <div className="loading">Loading events...</div>
      ) : events.length === 0 ? (
        <div className="empty-state">
          <p>No webhook events found</p>
          <p className="empty-hint">Events will appear here when webhooks are received</p>
        </div>
      ) : (
        <>
          <div className="events-list">
            {events.map((event) => {
              const isRawMode = viewMode[event.id] === 'raw';
              return (
                <div key={event.id} className={`event-card ${event.processed ? 'processed' : 'failed'}`}>
                  <div className="event-card-header">
                    <div className="event-status">
                      <span className="status-icon">{event.processed ? '✓' : '✕'}</span>
                      <span className="status-text">{event.processed ? 'Processed' : 'Failed'}</span>
                    </div>
                    <div className="event-time">{new Date(event.created_at).toLocaleString()}</div>
                    <button className="view-toggle-btn" onClick={() => toggleViewMode(event.id)}>
                      {isRawMode ? 'Formatted' : 'Raw JSON'}
                    </button>
                  </div>

                  {!event.processed && event.error_message && (
                    <div className="error-banner">
                      <strong>Error:</strong> {event.error_message}
                    </div>
                  )}

                  <div className="payload-container">
                    {isRawMode ? (
                      <pre className="payload-raw">
                        <code>{JSON.stringify(event.payload, null, 2)}</code>
                      </pre>
                    ) : (
                      formatPayloadForDisplay(event.payload)
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pagination">
            <p>
              Showing {pagination.offset + 1} to{' '}
              {Math.min(pagination.offset + pagination.limit, pagination.total)} of{' '}
              {pagination.total} events
            </p>
            <div className="pagination-buttons">
              <button
                onClick={() =>
                  setPagination({ ...pagination, offset: Math.max(0, pagination.offset - pagination.limit) })
                }
                disabled={pagination.offset === 0}
              >
                Previous
              </button>
              <button
                onClick={() =>
                  setPagination({ ...pagination, offset: pagination.offset + pagination.limit })
                }
                disabled={!pagination.has_more}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default WebhookEventHistory;
