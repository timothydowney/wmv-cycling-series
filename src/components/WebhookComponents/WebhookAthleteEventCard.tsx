import React, { useState, useEffect } from 'react';
import { api } from '../../api';
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
  const [enrichment, setEnrichment] = useState<EnrichedAthlete | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEnrichment = async () => {
      try {
        setLoading(true);
        const response = await api.getWebhookEventEnrichment(event.id);
        if (response && response.athlete) {
          setEnrichment(response.athlete);
        } else {
          setEnrichment(null);
        }
      } catch (err) {
        setEnrichment(null);
      } finally {
        setLoading(false);
      }
    };

    fetchEnrichment();
  }, [event.id]);

  const getHeaderTitle = (): React.ReactNode => {
    if (loading) {
      return <span className="header-fallback">Athlete {event.payload.object_id}</span>;
    }

    if (!enrichment?.name) {
      return <span className="header-fallback">Athlete {event.payload.object_id}</span>;
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
    if (loading) {
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
            Athlete {event.payload.object_id} was not found. It may not be accessible.
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
