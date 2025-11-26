import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import WebhookEventCard, { WebhookEvent } from './WebhookEventCard';
import './WebhookActivityEventCard.css';

interface EnrichedActivity {
  athlete: {
    athlete_id: number;
    name: string | null;
  };
  strava_data?: {
    activity_id: number;
    name: string;
    type: string;
    distance_m: number;
    moving_time_sec: number;
    elevation_gain_m: number;
    start_date_iso: string;
    device_name: string | null;
    segment_effort_count: number;
    visibility?: string | null;
  };
  activity?: {
    activity_id: number;
    start_date_unix: number;
    device_name: string | null;
    segment_efforts: number;
  };
  matching_seasons: Array<{
    season_id: number;
    season_name: string;
    matched_weeks_count: number;
    matched_weeks: Array<{
      week_id: number;
      week_name: string;
      segment_name: string;
      required_laps: number;
      segment_efforts_found?: number;
      matched: boolean;
      reason?: string;
    }>;
  }>;
  summary: {
    status: 'qualified' | 'no_matching_weeks' | 'no_segments' | 'insufficient_laps' | 'error' | 'no_qualifying_weeks';
    message: string;
    total_weeks_checked: number;
    total_weeks_matched: number;
    total_seasons: number;
  };
}

interface Props {
  event: WebhookEvent;
  onClose: () => void;
}

const WebhookActivityEventCard: React.FC<Props> = ({ event, onClose }) => {
  const [enrichment, setEnrichment] = useState<EnrichedActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEnrichment = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.getWebhookEventEnrichment(event.id);
        setEnrichment(response.enrichment);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load enrichment';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    if (event.payload.object_type === 'activity') {
      fetchEnrichment();
    }
  }, [event.id, event.payload.object_type]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'qualified':
        return '#27ae60';
      case 'no_matching_weeks':
      case 'no_segments':
      case 'insufficient_laps':
        return '#f39c12';
      case 'error':
        return '#e74c3c';
      default:
        return '#95a5a6';
    }
  };

  const renderActivityContent = () => {
    if (loading) {
      return (
        <div className="card-body">
          <div className="loading-spinner">Loading enriched details...</div>
        </div>
      );
    }

    if (error || !enrichment || !enrichment.athlete) {
      return (
        <div className="card-body">
          <div className="error-message">{error || 'Failed to load enrichment or athlete data'}</div>
        </div>
      );
    }

    const statusColor = getStatusColor(enrichment.summary?.status || 'error');

    return (
      <div className="card-body">
        {enrichment.strava_data ? (
          <>
            <div className="activity-link-line">
              <a
                href={`https://www.strava.com/activities/${enrichment.strava_data.activity_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="strava-link"
              >
                {enrichment.athlete?.name || 'Unknown'} - {enrichment.strava_data.name}
              </a>
              <span className="visibility-badge" data-visibility={enrichment.strava_data.visibility}>
                {enrichment.strava_data.visibility?.replace(/_/g, ' ')}
              </span>
            </div>

            {enrichment.summary && (
              <section className="section summary-section">
                <h4 className="section-title">SUMMARY</h4>
                <div className="summary-info" style={{ borderLeft: `3px solid ${statusColor}` }}>
                  <p className="summary-message">{enrichment.summary.message}</p>
                  <div className="summary-stats">
                    <div className="stat">
                      <span className="stat-label">Weeks Checked:</span>
                      <span className="stat-value">{enrichment.summary.total_weeks_checked}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Weeks Matched:</span>
                      <span className="stat-value" style={{ color: statusColor }}>
                        {enrichment.summary.total_weeks_matched}
                      </span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Seasons:</span>
                      <span className="stat-value">{enrichment.summary.total_seasons}</span>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {enrichment.matching_seasons && enrichment.matching_seasons.length > 0 && (
              <section className="section">
                <h4 className="section-title">MATCHING WEEKS</h4>
                {enrichment.matching_seasons.map((season) => (
                  <div key={season.season_id} className="season-block">
                    <div className="season-header">
                      <h5>{season.season_name}</h5>
                      <span className="season-stats">
                        {season.matched_weeks_count} / {season.matched_weeks.length} weeks matched
                      </span>
                    </div>

                    <div className="weeks-list">
                      {season.matched_weeks && season.matched_weeks.map((week) => (
                        <div
                          key={week.week_id}
                          className={`week-item ${week.matched ? 'matched' : 'unmatched'}`}
                          style={{
                            borderLeft: `3px solid ${week.matched ? '#27ae60' : '#e67e22'}`
                          }}
                        >
                          <div className="week-info">
                            <div className="week-name">{week.week_name}</div>
                            <div className="week-segment">{week.segment_name}</div>
                          </div>

                          <div className="week-status">
                            {week.matched ? (
                              <span className="badge matched">
                                ✓ {week.segment_efforts_found}/{week.required_laps} laps
                              </span>
                            ) : (
                              <span className="badge unmatched">{week.reason}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )}
          </>
        ) : (
          <div className="error-message-inline">
            Activity {event.payload.object_id} was not found on Strava. It may not be accessible.
          </div>
        )}

        {!event.processed && event.error_message && (
          <section className="section error-section">
            <h4 className="section-title">PROCESSING ERROR</h4>
            <div className="error-details">{event.error_message}</div>
          </section>
        )}
      </div>
    );
  };

  return (
    <WebhookEventCard
      event={event}
      onClose={onClose}
      renderContent={renderActivityContent}
      cssClass="activity-event-card"
    />
  );
};

export default WebhookActivityEventCard;
