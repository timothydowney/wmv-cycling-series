import React from 'react';
import { trpc } from '../../utils/trpc'; // Import trpc
import WebhookEventCard, { WebhookEvent } from './WebhookEventCard';
import './WebhookActivityEventCard.css';

interface EnrichedActivity {
  athlete: {
    athlete_id: string;
    name: string;
  };
  strava_data?: {
    activity_id: string;
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
  activity_detail?: {
    status: 'available' | 'private_or_unavailable' | 'token_unavailable' | 'unavailable' | 'deterministic_unavailable' | 'not_attempted';
    message: string | null;
    cached: boolean;
  };
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
  const [isExpanded, setIsExpanded] = React.useState(false);
  const { data: enrichmentData, isLoading, error: queryError } = trpc.webhookAdmin.getEnrichedEventDetails.useQuery(
    { id: event.id },
    {
      enabled: isExpanded && !!event.id && event.payload.object_type === 'activity',
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      select: (data) => data.enrichment,
    }
  );

  const enrichment: EnrichedActivity | null = enrichmentData || null;
  const error = queryError?.message || null;

  const renderDetailChip = (label: string, value: React.ReactNode) => (
    <div className="activity-detail-chip" key={label}>
      <span className="activity-detail-chip-label">{label}</span>
      <span className="activity-detail-chip-value">{value}</span>
    </div>
  );

  const formatSpecificMatchLabel = (prefix: string, names: string[] | undefined, count: number, fallbackLabel: string) => {
    if (!names || names.length === 0) {
      return fallbackLabel;
    }

    if (count <= 1) {
      return `${prefix}: ${names[0]}`;
    }

    return `${prefix}: ${names[0]} +${count - 1}`;
  };


  const getSummaryBadges = () => {
    const badges: Array<{ label: string; tone: 'competition' | 'explorer' | 'both' | 'none' | 'pending' | 'failed' | 'create' | 'update' | 'delete' | 'detail' }> = [
      {
        label: event.payload.aspect_type.charAt(0).toUpperCase() + event.payload.aspect_type.slice(1),
        tone: event.payload.aspect_type,
      },
    ];

    if (!event.activity_summary) {
      return badges;
    }

    const outcomeLabelMap = {
      competition: 'Competition',
      explorer: 'Explorer',
      both: 'Competition + Explorer',
      none: 'No match',
      pending: 'Pending',
      failed: 'Failed',
    } as const;

    badges.push(
      {
        label: outcomeLabelMap[event.activity_summary.outcome],
        tone: event.activity_summary.outcome,
      }
    );

    if (event.activity_summary.competition_week_count > 0) {
      badges.push({
        label: formatSpecificMatchLabel(
          'Week',
          event.activity_summary.competition_week_names,
          event.activity_summary.competition_week_count,
          `${event.activity_summary.competition_week_count} week${event.activity_summary.competition_week_count === 1 ? '' : 's'}`
        ),
        tone: 'competition',
      });
    }

    if (event.activity_summary.explorer_destination_count > 0) {
      badges.push({
        label: formatSpecificMatchLabel(
          'Destination',
          event.activity_summary.explorer_destination_names,
          event.activity_summary.explorer_destination_count,
          `${event.activity_summary.explorer_destination_count} destination${event.activity_summary.explorer_destination_count === 1 ? '' : 's'}`
        ),
        tone: 'explorer',
      });
    }

    if (enrichment?.activity_detail?.status === 'private_or_unavailable') {
      badges.push({ label: 'Private or unavailable', tone: 'detail' });
    } else if (enrichment?.activity_detail?.status === 'token_unavailable') {
      badges.push({ label: 'Needs Strava token', tone: 'detail' });
    }

    return badges;
  };

  const getHeaderTitle = (): React.ReactNode => {
    if (isLoading && isExpanded) {
      return <span className="header-fallback">{event.athlete_name || 'Athlete'} - Activity {event.payload.object_id}</span>;
    }

    if (!enrichment?.strava_data) {
      if (event.athlete_name || enrichment?.athlete?.name) {
        return (
          <span className="activity-header-inline activity-header-title-fallback">
            <span className="activity-header-athlete">{event.athlete_name || enrichment?.athlete?.name}</span>
            <span className="activity-header-separator">-</span>
            <span className="activity-header-name">Activity {event.payload.object_id}</span>
          </span>
        );
      }

      return <span className="header-fallback">Activity {event.payload.object_id}</span>;
    }

    const athleteName = enrichment.athlete?.name || `Athlete ${enrichment.athlete?.athlete_id || 'unknown'}`;
    const activityName = enrichment.strava_data.name;

    return (
      <a
        href={`https://www.strava.com/activities/${enrichment.strava_data.activity_id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="header-strava-link activity-header-link"
      >
          <span className="activity-header-inline">
          <span className="activity-header-athlete">{athleteName}</span>
            <span className="activity-header-separator">-</span>
          <span className="activity-header-name">{activityName}</span>
        </span>
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

    const detailState = enrichment.activity_detail?.status || 'not_attempted';
    const detailMessage = enrichment.activity_detail?.message || null;

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

            <section className="section summary-section">
              <h4 className="section-title">ACTIVITY DETAIL</h4>
              <div className="summary-info">
                <p className="summary-message">{enrichment.strava_data.name}</p>
                <div className="activity-detail-chips">
                  {renderDetailChip('Type', enrichment.strava_data.type)}
                  {renderDetailChip('Distance', `${(enrichment.strava_data.distance_m / 1000).toFixed(2)} km`)}
                  {renderDetailChip('Moving time', `${Math.round(enrichment.strava_data.moving_time_sec / 60)} min`)}
                  {renderDetailChip('Segment efforts', enrichment.strava_data.segment_effort_count)}
                  {enrichment.strava_data.elevation_gain_m != null && renderDetailChip('Elevation', `${Math.round(enrichment.strava_data.elevation_gain_m)} m`)}
                  {renderDetailChip('Start', new Date(enrichment.strava_data.start_date_iso).toLocaleString())}
                  {enrichment.strava_data.device_name && renderDetailChip('Device', enrichment.strava_data.device_name)}
                  {renderDetailChip('Detail source', enrichment.activity_detail?.cached ? 'Cache' : 'Strava')}
                </div>
              </div>
            </section>
          </>
        ) : (
          <section className="section summary-section">
            <h4 className="section-title">DETAIL GUIDANCE</h4>
            <div className="summary-info">
              <p className="summary-message">
                {detailMessage || 'Activity detail has not been loaded yet.'}
              </p>
              {detailState === 'private_or_unavailable' && (
                <p className="summary-guidance">
                  We still receive webhook events for private activities. Matching usually starts after the athlete changes the activity to public and Strava sends an update webhook.
                </p>
              )}
              {detailState === 'token_unavailable' && (
                <p className="summary-guidance">
                  The panel cannot look up activity detail until the athlete has a valid Strava connection in WMV.
                </p>
              )}
              {event.activity_summary?.message && (
                <p className="summary-guidance">Match status: {event.activity_summary.message}</p>
              )}
            </div>
          </section>
        )}

        <section className="section summary-section">
          <h4 className="section-title">EVENT CONTEXT</h4>
          <div className="summary-info">
            <div className="activity-detail-chips activity-detail-chips-context">
              {renderDetailChip('Webhook type', event.payload.aspect_type)}
              {renderDetailChip('Activity ID', event.payload.object_id)}
              {renderDetailChip('Athlete', enrichment.athlete.name)}
              {renderDetailChip('Event time', new Date(event.payload.event_time * 1000).toLocaleString())}
            </div>
          </div>
        </section>

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
      summaryText={event.activity_summary?.message}
      summaryBadges={getSummaryBadges()}
      onExpansionChange={setIsExpanded}
    />
  );
};

export default WebhookActivityEventCard;
