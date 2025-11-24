import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import './WebhookEventHistory.css';

interface WebhookEvent {
  id: number;
  created_at: string;
  aspect_type: string;
  object_type: string;
  object_id: number;
  owner_id: number;
  participant_name: string | null;
  processed: boolean;
  processed_at: string | null;
  error_message: string | null;
  retry_count: number;
}

interface WebhookEventsResponse {
  events: WebhookEvent[];
  total: number;
  limit: number;
  offset: number;
}

interface Props {
  onEventRetry: () => Promise<void>;
}

const WebhookEventHistory: React.FC<Props> = ({ onEventRetry }) => {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ total: 0, limit: 50, offset: 0, has_more: false });
  const [filters, setFilters] = useState({ type: 'all', status: 'all', since: 604800 });
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchEvents = async () => {
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
  };

  const handleRetry = async (eventId: number) => {
    setRetryingId(eventId);
    try {
      await api.retryWebhookEvent(eventId);
      setMessage('Event retried successfully');
      await onEventRetry();
      await fetchEvents();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to retry event';
      setMessage(msg);
    } finally {
      setRetryingId(null);
    }
  };

  const handleClearAll = async () => {
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
  };

  useEffect(() => {
    fetchEvents();
  }, [filters, pagination.offset]);

  const getEventTypeLabel = (type: string): string => {
    switch (type) {
      case 'create':
        return 'Created';
      case 'update':
        return 'Updated';
      case 'delete':
        return 'Deleted';
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  const getEventIcon = (type: string): string => {
    switch (type) {
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

  return (
    <div className="event-history">
      <div className="event-filters">
        <div className="filter-group">
          <label htmlFor="type-filter">Type:</label>
          <select
            id="type-filter"
            value={filters.type}
            onChange={(e) => {
              setFilters({ ...filters, type: e.target.value });
              setPagination({ ...pagination, offset: 0 });
            }}
          >
            <option value="all">All Types</option>
            <option value="create">Created</option>
            <option value="update">Updated</option>
            <option value="delete">Deleted</option>
          </select>
        </div>

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
            {events.map((event) => (
              <div key={event.id} className={`event-item ${event.processed ? 'success' : 'failed'}`}>
                <div className="event-icon">
                  {event.processed ? '✓' : '✕'}
                </div>
                <div className="event-content">
                  <div className="event-header">
                    <span className="event-type">{getEventIcon(event.aspect_type)} {getEventTypeLabel(event.aspect_type)}</span>
                    <span className="event-time">
                      {new Date(event.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="event-details">
                    <span className="detail-item">
                      <strong>Participant:</strong> {event.participant_name || 'Unknown'}
                    </span>
                    <span className="detail-item">
                      <strong>Object ID:</strong> {event.object_id}
                    </span>
                    {event.processed && event.processed_at && (
                      <span className="detail-item">
                        <strong>Processed:</strong> {new Date(event.processed_at).toLocaleString()}
                      </span>
                    )}
                    {!event.processed && event.error_message && (
                      <span className="detail-item error">
                        <strong>Error:</strong> {event.error_message}
                      </span>
                    )}
                    {event.retry_count > 0 && (
                      <span className="detail-item">
                        <strong>Retries:</strong> {event.retry_count}/3
                      </span>
                    )}
                  </div>
                </div>
                {!event.processed && event.retry_count < 3 && (
                  <button
                    className="retry-btn"
                    onClick={() => handleRetry(event.id)}
                    disabled={retryingId === event.id}
                  >
                    {retryingId === event.id ? 'Retrying...' : 'Retry'}
                  </button>
                )}
              </div>
            ))}
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
