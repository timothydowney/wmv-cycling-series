import React from 'react';
import { trpc } from '../../utils/trpc'; // Import trpc
import WebhookEventCard, { WebhookEvent } from './WebhookEventCard';
import './WebhookAthleteEventCard.css';

interface EnrichedAthlete {
  athlete_id: number;
  name: string | null;
  profile_url?: string;
}

interface WebhookAthleteEventCardProps {
  event: WebhookEvent;
}

const WebhookAthleteEventCard: React.FC<WebhookAthleteEventCardProps> = ({ event }) => {
  const { data: enrichmentData, isLoading } = trpc.webhookAdmin.getEnrichedEventDetails.useQuery(
    { id: event.id },
    {
      enabled: !!event.id, // Only run query if event.id exists
      select: (data) => data.enrichment?.athlete, // Select only the athlete part
    }
  );

  const enrichment: EnrichedAthlete | null = enrichmentData || null;

  const getHeaderTitle = (): React.ReactNode => {
    if (isLoading) {
      return <span className="header-fallback">Athlete {event.payload.owner_id}</span>;
    }

    if (!enrichment?.name) {
      return <span className="header-fallback">Athlete {event.payload.owner_id}</span>;
    }

    return (
      <a
        href={`https://www.strava.com/athletes/${enrichment.athlete_id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="header-strava-link"
      >
        {enrichment.name}
      </a>
    );
  };

  const renderAthleteContent = () => {
    if (isLoading) {
      return (
        <div className="card-body">
          <div className="loading-spinner">Loading athlete details...</div>
        </div>
      );
    }

    return (
      <div className="card-body">
        {enrichment && enrichment.name ? (
          <div className="athlete-detail">
            <p>Athlete connected</p>
          </div>
        ) : (
          <div className="error-message-inline">
            Athlete {event.payload.owner_id} was not found. It may not be accessible.
          </div>
        )}
      </div>
    );
  };

  return (
    <WebhookEventCard
      event={event}
      renderContent={renderAthleteContent}
      cssClass="athlete-event-card"
      headerTitle={getHeaderTitle()}
      hasMatch={false}
    />
  );
};

export default WebhookAthleteEventCard;
