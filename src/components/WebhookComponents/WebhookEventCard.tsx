import React, { useState } from 'react';
import './WebhookEventCard.css';
import { formatUtcIsoDateTime } from '../../utils/dateUtils';
import { trpc } from '../../utils/trpc';

export interface WebhookPayload {
  aspect_type: 'create' | 'update' | 'delete';
  event_time: number;
  object_id: number;
  object_type: 'activity' | 'athlete';
  owner_id: number;
  subscription_id: number;
  updates?: Record<string, unknown>;
}

export interface WebhookEvent {
  id: number;
  created_at: string | null;
  payload: WebhookPayload;
  processed: boolean | null;
  error_message: string | null;
  activity_summary?: {
    outcome: 'competition' | 'explorer' | 'both' | 'none' | 'pending' | 'failed';
    competition_week_count: number;
    competition_season_count: number;
    explorer_destination_count: number;
    explorer_campaign_count: number;
    competition_week_names?: string[];
    explorer_destination_names?: string[];
    message: string;
  };
}

interface SummaryBadge {
  label: string;
  tone: 'competition' | 'explorer' | 'both' | 'none' | 'pending' | 'failed' | 'create' | 'update' | 'delete' | 'detail';
}

interface WebhookEventCardProps {
  event: WebhookEvent;
  renderContent: (isRawMode: boolean) => React.ReactNode;
  cssClass?: string;
  headerTitle?: React.ReactNode;
  summaryText?: string;
  summaryBadges?: SummaryBadge[];
  onExpansionChange?: (isExpanded: boolean) => void;
}

const WebhookEventCard: React.FC<WebhookEventCardProps> = ({
  event,
  renderContent,
  cssClass = 'webhook-event-card',
  headerTitle,
  summaryText,
  summaryBadges = [],
  onExpansionChange,
}) => {
  const [showRawJson, setShowRawJson] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const utils = trpc.useUtils();

  const replayMutation = trpc.webhookAdmin.replayEvent.useMutation({
    onSuccess: () => {
      utils.webhookAdmin.getEvents.invalidate();
    },
  });

  const handleReplay = async () => {
    if (window.confirm('Replay this event? This will re-run the matching logic using the stored payload.')) {
      try {
        await replayMutation.mutateAsync({ id: event.id });
        alert('Event replayed successfully.');
      } catch (error: any) {
        console.error('Failed to replay event:', error);
        alert(`Failed to replay event: ${error.message || 'Unknown error'}`);
      }
    }
  };

  return (
    <div className={cssClass}>
      {/* Card Header */}
      <div className="webhook-card-header">
        <div className="header-meta-row">
          <span className="header-created">Created</span>
          <span className="header-timestamp">{formatUtcIsoDateTime(event.created_at)}</span>
        </div>

        <div className="header-main-row">
          <div className="header-content">
            <div className="header-title-row">
              {headerTitle || <span className="header-fallback">Event {event.id}</span>}
            </div>
            {(summaryBadges.length > 0 || summaryText) && (
              <div className="header-summary">
                {summaryBadges.length > 0 && (
                  <div className="summary-badges">
                    {summaryBadges.map((badge) => (
                      <span
                        key={`${badge.tone}-${badge.label}`}
                        className={`summary-badge summary-badge-${badge.tone}`}
                      >
                        {badge.label}
                      </span>
                    ))}
                  </div>
                )}
                {summaryText && <span className="summary-text">{summaryText}</span>}
              </div>
            )}
          </div>

          <div className="header-right">
          <button 
            className="collapse-btn" 
            onClick={() => {
              setIsCollapsed((previousValue) => {
                const nextCollapsed = !previousValue;
                onExpansionChange?.(!nextCollapsed);
                return nextCollapsed;
              });
            }}
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? '▶' : '▼'}
          </button>
          </div>
        </div>
      </div>

      {/* Card Body - Hidden when collapsed */}
      {!isCollapsed && (
        <div className="card-body">
          <div className="card-controls">
            <button className="view-toggle-btn" onClick={() => setShowRawJson(!showRawJson)}>
              {showRawJson ? 'Formatted' : 'Raw JSON'}
            </button>
            <button 
              className="replay-btn" 
              onClick={handleReplay}
              disabled={replayMutation.isPending}
            >
              {replayMutation.isPending ? 'Replaying...' : 'Replay'}
            </button>
          </div>
          {showRawJson ? (
            // Raw Webhook Event Data
            <section className="section raw-json-section">
              <h4 className="section-title">RAW WEBHOOK EVENT</h4>
              <pre className="raw-json-content">{JSON.stringify(event, null, 2)}</pre>
            </section>
          ) : (
            // Formatted View - delegated to child
            renderContent(false)
          )}
        </div>
      )}
    </div>
  );
};

export default WebhookEventCard;
