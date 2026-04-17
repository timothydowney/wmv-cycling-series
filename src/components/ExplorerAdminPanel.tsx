import { useEffect, useRef, useState } from 'react';
import type { Season } from '../types';
import { trpc } from '../utils/trpc';
import { formatUnixDate } from '../utils/dateUtils';
import SeasonSelector from './SeasonSelector';
import './AdminPanel.css';
import './ExplorerAdminPanel.css';

interface ExplorerAdminPanelProps {
  isAdmin: boolean;
  seasons: Season[];
  selectedSeasonId: number | null;
  onSeasonChange: (seasonId: number) => void;
}

interface FlashMessage {
  type: 'success' | 'error' | 'info';
  text: string;
}

function ExplorerAdminPanel({
  isAdmin,
  seasons,
  selectedSeasonId,
  onSeasonChange,
}: ExplorerAdminPanelProps) {
  const utils = trpc.useUtils();
  const messageTimeoutRef = useRef<number | null>(null);
  const [campaignForm, setCampaignForm] = useState({
    displayName: '',
    rulesBlurb: '',
  });
  const [destinationForm, setDestinationForm] = useState({
    sourceUrl: '',
    displayLabel: '',
  });
  const [message, setMessage] = useState<FlashMessage | null>(null);

  const resolvedSeasonId = selectedSeasonId ?? seasons[0]?.id ?? null;
  const selectedSeason = seasons.find((season) => season.id === resolvedSeasonId) || null;

  useEffect(() => {
    return () => {
      if (messageTimeoutRef.current !== null) {
        window.clearTimeout(messageTimeoutRef.current);
      }
    };
  }, []);

  const campaignQuery = trpc.explorerAdmin.getCampaignForSeason.useQuery(
    { seasonId: resolvedSeasonId ?? 0 },
    {
      enabled: isAdmin && resolvedSeasonId !== null,
      refetchOnWindowFocus: false,
    }
  );

  const setTimedMessage = (nextMessage: FlashMessage, timeoutMs: number = 5000) => {
    setMessage(nextMessage);

    if (messageTimeoutRef.current !== null) {
      window.clearTimeout(messageTimeoutRef.current);
    }

    messageTimeoutRef.current = window.setTimeout(() => {
      setMessage(null);
      messageTimeoutRef.current = null;
    }, timeoutMs);
  };

  const createCampaignMutation = trpc.explorerAdmin.createCampaign.useMutation({
    onSuccess: async () => {
      await utils.explorerAdmin.getCampaignForSeason.invalidate({ seasonId: resolvedSeasonId ?? 0 });
      setCampaignForm({ displayName: '', rulesBlurb: '' });
      setTimedMessage({ type: 'success', text: 'Explorer campaign created for the selected season.' });
    },
    onError: (error) => {
      setTimedMessage({ type: 'error', text: error.message });
    },
  });

  const addDestinationMutation = trpc.explorerAdmin.addDestination.useMutation({
    onSuccess: async (destination) => {
      await utils.explorerAdmin.getCampaignForSeason.invalidate({ seasonId: resolvedSeasonId ?? 0 });
      setDestinationForm({ sourceUrl: '', displayLabel: '' });

      const isMetadataFallback = destination.cached_name === `Segment ${destination.strava_segment_id}`;
      setTimedMessage({
        type: isMetadataFallback ? 'info' : 'success',
        text: isMetadataFallback
          ? 'Destination added with placeholder metadata because live segment enrichment was unavailable.'
          : 'Destination added to the Explorer campaign.',
      });
    },
    onError: (error) => {
      setTimedMessage({ type: 'error', text: error.message });
    },
  });

  const handleCreateCampaign = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!resolvedSeasonId) {
      setTimedMessage({ type: 'error', text: 'Select a season before creating an Explorer campaign.' });
      return;
    }

    await createCampaignMutation.mutateAsync({
      seasonId: resolvedSeasonId,
      displayName: campaignForm.displayName.trim() || null,
      rulesBlurb: campaignForm.rulesBlurb.trim() || null,
    });
  };

  const handleAddDestination = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!campaignQuery.data) {
      setTimedMessage({ type: 'error', text: 'Create a campaign before adding Explorer destinations.' });
      return;
    }

    await addDestinationMutation.mutateAsync({
      explorerCampaignId: campaignQuery.data.id,
      sourceUrl: destinationForm.sourceUrl.trim(),
      displayLabel: destinationForm.displayLabel.trim() || null,
    });
  };

  if (!isAdmin) {
    return (
      <div className="explorer-admin-panel" data-testid="explorer-admin-panel">
        <div className="explorer-admin-access-denied">
          <h2>Access Denied</h2>
          <p>You do not have admin permissions to manage Explorer campaigns.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="explorer-admin-panel" data-testid="explorer-admin-panel">
      {message && (
        <div className={`explorer-message ${message.type}`} data-testid="explorer-admin-message">
          {message.text}
        </div>
      )}

      {seasons.length > 0 && (
        <div className="admin-season-selector-wrapper">
          <SeasonSelector
            seasons={seasons}
            selectedSeasonId={resolvedSeasonId}
            setSelectedSeasonId={onSeasonChange}
          />
        </div>
      )}

      {seasons.length === 0 ? (
        <div className="explorer-empty-state">
          <h2>No seasons available</h2>
          <p>Create a season before setting up an Explorer campaign.</p>
        </div>
      ) : !selectedSeason ? (
        <div className="explorer-empty-state">
          <h2>Select a season</h2>
          <p>Choose a season before managing an Explorer campaign.</p>
        </div>
      ) : (
        <>
          <section className="explorer-season-summary" data-testid="explorer-season-summary">
            <div>
              <p className="explorer-section-label">Selected season</p>
              <h2>{selectedSeason.name}</h2>
            </div>
            <p className="explorer-season-window">
              {formatUnixDate(selectedSeason.start_at)} to {formatUnixDate(selectedSeason.end_at)}
            </p>
          </section>

          {campaignQuery.isLoading ? (
            <div className="explorer-card">
              <p>Loading Explorer campaign setup...</p>
            </div>
          ) : campaignQuery.error ? (
            <div className="explorer-card explorer-error-card">
              <p>{campaignQuery.error.message}</p>
            </div>
          ) : !campaignQuery.data ? (
            <section className="explorer-card" data-testid="explorer-create-campaign-card">
              <div className="explorer-card-header">
                <div>
                  <p className="explorer-section-label">Phase 4B setup</p>
                  <h3>Create Explorer Campaign</h3>
                </div>
                <p>Each season can have one Explorer campaign in v1.</p>
              </div>

              <form className="explorer-form" onSubmit={handleCreateCampaign} data-testid="explorer-create-campaign-form">
                <div className="explorer-form-group">
                  <label htmlFor="explorer-display-name">Campaign name</label>
                  <input
                    id="explorer-display-name"
                    data-testid="explorer-display-name-input"
                    value={campaignForm.displayName}
                    onChange={(event) =>
                      setCampaignForm((current) => ({ ...current, displayName: event.target.value }))
                    }
                    placeholder={`Defaults to ${selectedSeason.name}`}
                    maxLength={255}
                  />
                </div>

                <div className="explorer-form-group">
                  <label htmlFor="explorer-rules-blurb">Rules blurb</label>
                  <textarea
                    id="explorer-rules-blurb"
                    data-testid="explorer-rules-blurb-input"
                    value={campaignForm.rulesBlurb}
                    onChange={(event) =>
                      setCampaignForm((current) => ({ ...current, rulesBlurb: event.target.value }))
                    }
                    placeholder="Optional guidance shown alongside the Explorer campaign"
                    rows={4}
                    maxLength={2000}
                  />
                </div>

                <div className="explorer-form-actions">
                  <button
                    type="submit"
                    className="explorer-submit-button"
                    data-testid="explorer-create-campaign-button"
                    disabled={createCampaignMutation.isPending}
                  >
                    {createCampaignMutation.isPending ? 'Creating...' : 'Create Explorer Campaign'}
                  </button>
                </div>
              </form>
            </section>
          ) : (
            <>
              <section className="explorer-card" data-testid="explorer-campaign-summary-card">
                <div className="explorer-card-header">
                  <div>
                    <p className="explorer-section-label">Explorer campaign</p>
                    <h3 data-testid="explorer-campaign-name">{campaignQuery.data.name}</h3>
                  </div>
                  <p>{campaignQuery.data.destinations.length} destination{campaignQuery.data.destinations.length === 1 ? '' : 's'}</p>
                </div>

                {campaignQuery.data.rulesBlurb ? (
                  <p className="explorer-rules-blurb" data-testid="explorer-campaign-rules-blurb">{campaignQuery.data.rulesBlurb}</p>
                ) : (
                  <p className="explorer-muted-copy">No rules blurb has been added yet.</p>
                )}
              </section>

              <section className="explorer-card" data-testid="explorer-add-destination-card">
                <div className="explorer-card-header">
                  <div>
                    <p className="explorer-section-label">Destination authoring</p>
                    <h3>Add Destination</h3>
                  </div>
                  <p>Paste a Strava segment URL. Explorer keeps the source URL and cached display metadata.</p>
                </div>

                <form className="explorer-form" onSubmit={handleAddDestination} data-testid="explorer-add-destination-form">
                  <div className="explorer-form-group">
                    <label htmlFor="explorer-source-url">Strava segment URL</label>
                    <input
                      id="explorer-source-url"
                      data-testid="explorer-source-url-input"
                      value={destinationForm.sourceUrl}
                      onChange={(event) =>
                        setDestinationForm((current) => ({ ...current, sourceUrl: event.target.value }))
                      }
                      placeholder="https://www.strava.com/segments/2234642"
                      required
                    />
                  </div>

                  <div className="explorer-form-group">
                    <label htmlFor="explorer-display-label">Display label</label>
                    <input
                      id="explorer-display-label"
                      data-testid="explorer-display-label-input"
                      value={destinationForm.displayLabel}
                      onChange={(event) =>
                        setDestinationForm((current) => ({ ...current, displayLabel: event.target.value }))
                      }
                      placeholder="Optional label to override the cached segment name"
                    />
                  </div>

                  <div className="explorer-form-actions">
                    <button
                      type="submit"
                      className="explorer-submit-button"
                      data-testid="explorer-add-destination-button"
                      disabled={addDestinationMutation.isPending}
                    >
                      {addDestinationMutation.isPending ? 'Adding...' : 'Add Destination'}
                    </button>
                  </div>
                </form>
              </section>

              <section className="explorer-card" data-testid="explorer-destination-list-card">
                <div className="explorer-card-header">
                  <div>
                    <p className="explorer-section-label">Current campaign map</p>
                    <h3>Destinations</h3>
                  </div>
                </div>

                {campaignQuery.data.destinations.length === 0 ? (
                  <p className="explorer-muted-copy">No destinations added yet.</p>
                ) : (
                  <ol className="explorer-destination-list" data-testid="explorer-destination-list">
                    {campaignQuery.data.destinations.map((destination) => (
                      <li
                        key={destination.id}
                        className="explorer-destination-item"
                        data-testid={`explorer-destination-row-${destination.id}`}
                      >
                        <div>
                          <p className="explorer-destination-label">{destination.displayLabel}</p>
                          <p className="explorer-destination-meta">
                            Segment {destination.stravaSegmentId}
                            {destination.sourceUrl ? ` • ${destination.sourceUrl}` : ''}
                          </p>
                        </div>
                        <span className="explorer-destination-order">#{destination.displayOrder + 1}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default ExplorerAdminPanel;