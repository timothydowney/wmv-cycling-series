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
  onClose: () => void;
}

const WebhookAthleteEventCard: React.FC<WebhookAthleteEventCardProps> = ({ event, onClose }) => {
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
          <div className="athlete-link-line">
            <a
              href={`https://www.strava.com/athletes/${enrichment.athlete_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="strava-link"
            >
              {enrichment.name}
            </a>
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
      onClose={onClose}
      renderContent={renderAthleteContent}
      cssClass="athlete-event-card"
    />
  );
};

export default WebhookAthleteEventCard;
