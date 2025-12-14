import React from 'react';
import { trpc } from '../../utils/trpc'; // Import trpc
import WebhookEventCard, { WebhookEvent } from './WebhookEventCard';
import './WebhookActivityEventCard.css';

interface EnrichedActivity {
  athlete: {
    athlete_id: number;
    name: string;
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
  matching_seasons: Array<{
    season_id: number;
    season_name: string;
    matched_weeks: Array<{
      week_id: number;
      week_name: string;
      segment_effort_count: number;
      total_time_seconds: number;
    }>;
  }>;
  summary: {
    status: 'qualified' | 'no_match' | 'pending' | 'error' | 'not_processed';
    message: string;
    total_weeks_matched: number;
    total_seasons: number;
  };
}

interface Props {
  event: WebhookEvent;
}

const WebhookActivityEventCard: React.FC<Props> = ({ event }) => {
  const { data: enrichmentData, isLoading, error: queryError } = trpc.webhookAdmin.getEnrichedEventDetails.useQuery(
    { id: event.id },
    {
      enabled: !!event.id && event.payload.object_type === 'activity', // Only run query if event.id exists and is an activity
      select: (data) => data.enrichment,
    }
  );

  const enrichment: EnrichedActivity | null = enrichmentData || null;
  const error = queryError?.message || null;


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'qualified':
        return '#27ae60';
      case 'no_match': // Changed from no_matching_weeks for brevity
      case 'no_segments':
      case 'insufficient_laps':
        return '#f39c12';
      case 'error':
        return '#e74c3c';
      default:
        return '#95a5a6';
    }
  };

  const getHeaderTitle = (): React.ReactNode => {
    if (isLoading) {
      return <span className="header-fallback">Activity {event.payload.object_id}</span>;
    }

    if (!enrichment?.strava_data) {
      return <span className="header-fallback">Activity {event.payload.object_id}</span>;
    }

    const athleteName = enrichment.athlete?.name || `Athlete ${enrichment.athlete?.athlete_id || 'unknown'}`;
    const activityName = enrichment.strava_data.name;

    return (
      <a
        href={`https://www.strava.com/activities/${enrichment.strava_data.activity_id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="header-strava-link"
      >
        {athleteName} - {activityName}
      </a>
    );
  };

  const renderActivityContent = () => {
    if (isLoading) {
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
            {enrichment.strava_data.visibility && (
              <div className="visibility-line">
                <span className="visibility-badge" data-visibility={enrichment.strava_data.visibility}>
                  {enrichment.strava_data.visibility?.replace(/_/g, ' ')}
                </span>
              </div>
            )}

            {enrichment.summary && (
              <section className="section summary-section">
                <h4 className="section-title">SUMMARY</h4>
                <div className="summary-info" style={{ borderLeft: `3px solid ${statusColor}` }}>
                  <p className="summary-message">{enrichment.summary.message}</p>
                  <div className="summary-stats">
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
                        {season.matched_weeks.length} week(s) stored
                      </span>
                    </div>

                    <div className="weeks-list">
                      {season.matched_weeks && season.matched_weeks.map((week) => (
                        <div
                          key={week.week_id}
                          className="week-item matched"
                          style={{
                            borderLeft: '3px solid #27ae60'
                          }}
                        >
                          <div className="week-info">
                            <div className="week-name">{week.week_name}</div>
                            <div className="week-time">
                              {week.total_time_seconds ? `${Math.round(week.total_time_seconds / 60)} min` : 'N/A'}
                            </div>
                          </div>

                          <div className="week-status">
                            <div className="week-time">
                              {week.total_time_seconds ? `${Math.round(week.total_time_seconds / 60)} min` : 'N/A'}
                            </div>
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
      renderContent={renderActivityContent}
      cssClass="activity-event-card"
      headerTitle={getHeaderTitle()}
      hasMatch={(enrichment?.summary.total_weeks_matched ?? 0) > 0}
    />
  );
};

export default WebhookActivityEventCard;
