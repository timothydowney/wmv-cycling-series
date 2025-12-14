import React, { useState } from 'react';
import './WebhookEventCard.css';
import { formatUtcIsoDateTime } from '../../utils/dateUtils';

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
  processed: number | null;
  error_message: string | null;
}

interface WebhookEventCardProps {
  event: WebhookEvent;
  renderContent: (isRawMode: boolean) => React.ReactNode;
  cssClass?: string;
  headerTitle?: React.ReactNode;
  hasMatch?: boolean;
}

const WebhookEventCard: React.FC<WebhookEventCardProps> = ({
  event,
  renderContent,
  cssClass = 'webhook-event-card',
  headerTitle,
  hasMatch = false
}) => {
  const [showRawJson, setShowRawJson] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);

  return (
    <div className={cssClass}>
      {/* Card Header */}
      <div className="card-header">
        <div className="header-left">
          <span className="header-created">Created</span>
          <span className="header-timestamp">{formatUtcIsoDateTime(event.created_at)}</span>
        </div>
        
        <div className="header-center">
          {headerTitle || <span className="header-fallback">Event {event.id}</span>}
          {hasMatch && <span className="match-indicator" title="Has matching weeks">✓</span>}
        </div>
        
        <div className="header-right">
          <button 
            className="collapse-btn" 
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? '▶' : '▼'}
          </button>
        </div>
      </div>

      {/* Card Body - Hidden when collapsed */}
      {!isCollapsed && (
        <div className="card-body">
          <button className="view-toggle-btn" onClick={() => setShowRawJson(!showRawJson)}>
            {showRawJson ? 'Formatted' : 'Raw JSON'}
          </button>
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
