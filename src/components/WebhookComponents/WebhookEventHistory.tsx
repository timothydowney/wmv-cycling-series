import React, { useState, useEffect, useCallback } from 'react';
import { trpc } from '../../utils/trpc'; // Import trpc
import WebhookActivityEventCard from './WebhookActivityEventCard';
import WebhookAthleteEventCard from './WebhookAthleteEventCard';
import './WebhookEventHistory.css';
import { keepPreviousData } from '@tanstack/react-query'; // Import keepPreviousData
import { TRPCClientErrorLike } from '@trpc/client'; // Import TRPCClientErrorLike


interface WebhookPayload {
  aspect_type: 'create' | 'update' | 'delete';
  event_time: number;
  object_id: number;
  object_type: 'activity' | 'athlete';
  owner_id: number;
  subscription_id: number;
  updates?: Record<string, unknown>;
}

interface Props {
  // No props required for now
}

const WebhookEventHistory: React.FC<Props> = () => {
  const [pagination, setPagination] = useState({ limit: 50, offset: 0 });
  const [filters, setFilters] = useState({ status: 'all', since: 604800 }); // Default to 7 days
  const [message, setMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<Record<number, 'raw' | 'formatted'>>({});

  const { data, isLoading, error: queryError, refetch } = trpc.webhookAdmin.getEvents.useQuery(
    {
      limit: pagination.limit,
      offset: pagination.offset,
      since: filters.since,
      status: filters.status as 'all' | 'success' | 'failed',
    },
    {
      placeholderData: keepPreviousData, // Keep data while fetching new page/filters
      // Rely on queryError for display, use local message for mutations
    }
  );

  const clearEventsMutation = trpc.webhookAdmin.clearEvents.useMutation({
    onSuccess: () => {
      setMessage('All events cleared successfully');
      refetch();
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (err: TRPCClientErrorLike<any>) => { // Explicitly type err as TRPCClientErrorLike
      setMessage(`Failed to clear events: ${err.message}`);
    }
  });

  const handleClearAll = useCallback(() => {
    if (!window.confirm(`Clear all ${data?.total || 0} webhook events? This cannot be undone.`)) {
      return;
    }
    clearEventsMutation.mutate({ confirm: 'yes' });
  }, [data?.total, clearEventsMutation]);

  // Refetch when filters or pagination change
  useEffect(() => {
    refetch();
  }, [pagination, filters, refetch]);


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

  const currentError = queryError?.message; // Consolidate error messages

  const events = data?.events || [];
  const total = data?.total || 0;
  const has_more = (data?.offset || 0) + (data?.limit || 0) < total;

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

        <button className="clear-btn" onClick={handleClearAll} disabled={isLoading || clearEventsMutation.isPending || total === 0}>
          Clear All Events
        </button>
      </div>

      {message && <div className="success-message">{message}</div>}
      {currentError && <div className="error-message">{currentError}</div>}

      {isLoading ? (
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
              // For activity events, show enriched activity card
              if (event.payload && event.payload.object_type === 'activity') {
                return (
                  <WebhookActivityEventCard
                    key={event.id}
                    event={event}
                  />
                );
              }

              // For athlete events, show enriched athlete card
              if (event.payload && event.payload.object_type === 'athlete') {
                return (
                  <WebhookAthleteEventCard
                    key={event.id}
                    event={event}
                  />
                );
              }

              // For other event types, show simple card (shouldn't happen)
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
              {Math.min(pagination.offset + pagination.limit, total)} of{' '}
              {total} events
            </p>
            <div className="pagination-buttons">
              <button
                onClick={() =>
                  setPagination((prev) => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))
                }
                disabled={pagination.offset === 0}
              >
                Previous
              </button>
              <button
                onClick={() =>
                  setPagination((prev) => ({ ...prev, offset: prev.offset + prev.limit }))
                }
                disabled={!has_more}
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

