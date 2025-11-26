import React, { useState } from 'react';

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
  created_at: string;
  payload: WebhookPayload;
  processed: boolean;
  error_message: string | null;
}

interface AspectBadge {
  icon: string;
  label: string;
  color: string;
}

interface WebhookEventCardProps {
  event: WebhookEvent;
  onClose: () => void;
  getAspectBadge?: (aspect: string) => AspectBadge;
  renderContent: (isRawMode: boolean) => React.ReactNode;
  cssClass?: string;
}

const WebhookEventCard: React.FC<WebhookEventCardProps> = ({
  event,
  onClose,
  getAspectBadge,
  renderContent,
  cssClass = 'webhook-event-card'
}) => {
  const [showRawJson, setShowRawJson] = useState(false);

  const defaultGetAspectBadge = (aspect: string): AspectBadge => {
    const badges: Record<string, AspectBadge> = {
      create: { icon: '➕', label: 'Created', color: '#27ae60' },
      update: { icon: '♻️', label: 'Updated', color: '#3498db' },
      delete: { icon: '🗑️', label: 'Deleted', color: '#e74c3c' }
    };
    return badges[aspect] || { icon: '📌', label: 'Event', color: '#95a5a6' };
  };

  const badge = getAspectBadge ? getAspectBadge(event.payload.aspect_type) : defaultGetAspectBadge(event.payload.aspect_type);

  return (
    <div className={cssClass}>
      {/* Card Header */}
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
          <span style={{ fontWeight: 'bold', color: badge.color }}>{badge.label}</span>
          <span className="event-timestamp">{new Date(event.created_at).toLocaleString()}</span>
        </div>
        <button className="view-toggle-btn" onClick={() => setShowRawJson(!showRawJson)}>
          {showRawJson ? 'Formatted' : 'Raw JSON'}
        </button>
        <button className="close-btn" onClick={onClose}>
          ✕
        </button>
      </div>

      {/* Card Body */}
      <div className="card-body">
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
    </div>
  );
};

export default WebhookEventCard;
