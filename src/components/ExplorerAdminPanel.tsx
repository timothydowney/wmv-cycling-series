import { useEffect, useRef, useState } from 'react';
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  CheckIcon,
  MapPinIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import type { Season } from '../types';
import { trpc } from '../utils/trpc';
import { formatUnixDate } from '../utils/dateUtils';
import SeasonSelector from './SeasonSelector';
import './AdminPanel.css';
import './Card.css';
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

interface PreviewDestination {
  sourceUrl: string;
  stravaSegmentId: string;
  name: string;
  distance?: number | null;
  averageGrade?: number | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}

function parseSegmentId(sourceUrl: string): string | null {
  const trimmedSourceUrl = sourceUrl.trim();
  const segmentMatch = trimmedSourceUrl.match(/^https?:\/\/(?:www\.)?strava\.com\/segments\/(\d+)(?:[/?#].*)?$/i);

  return segmentMatch?.[1] ?? null;
}

function formatSegmentDistance(distance?: number | null): string | null {
  if (distance == null) {
    return null;
  }

  return `${(distance / 1000).toFixed(2)} km`;
}

function formatAverageGrade(averageGrade?: number | null): string | null {
  if (averageGrade == null) {
    return null;
  }

  return `${averageGrade.toFixed(1)}% avg grade`;
}

function formatLocation(city?: string | null, state?: string | null, country?: string | null): string | null {
  const locationParts = [city, state, country].filter(Boolean);

  return locationParts.length > 0 ? locationParts.join(', ') : null;
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
  const [destinationPreview, setDestinationPreview] = useState<PreviewDestination | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isValidatingPreview, setIsValidatingPreview] = useState(false);
  const [message, setMessage] = useState<FlashMessage | null>(null);

  const hasSelectedSeason =
    selectedSeasonId !== null && seasons.some((season) => season.id === selectedSeasonId);
  const resolvedSeasonId = hasSelectedSeason ? selectedSeasonId : seasons[0]?.id ?? null;
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
      setDestinationPreview(null);
      setPreviewError(null);

      setTimedMessage({
        type: destination.usedPlaceholderMetadata ? 'info' : 'success',
        text: destination.usedPlaceholderMetadata
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

  const requestDestinationPreview = async () => {
    const trimmedSourceUrl = destinationForm.sourceUrl.trim();

    if (!trimmedSourceUrl) {
      setDestinationPreview(null);
      setPreviewError(null);
      return;
    }

    const parsedSegmentId = parseSegmentId(trimmedSourceUrl);

    if (!parsedSegmentId) {
      setDestinationPreview(null);
      setPreviewError('Please provide a valid Strava segment URL');
      return;
    }

    setIsValidatingPreview(true);
    setPreviewError(null);

    try {
      const segment = await utils.client.segment.validate.query(parsedSegmentId);

      if (!segment) {
        throw new Error('Segment metadata could not be loaded');
      }

      setDestinationPreview({
        sourceUrl: trimmedSourceUrl,
        stravaSegmentId: segment.strava_segment_id,
        name: segment.name,
        distance: segment.distance,
        averageGrade: segment.average_grade,
        city: segment.city,
        state: segment.state,
        country: segment.country,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Segment metadata could not be loaded';
      setDestinationPreview(null);
      setPreviewError(errorMessage);
    } finally {
      setIsValidatingPreview(false);
    }
  };

  const handleAcceptPreview = async () => {
    if (!destinationPreview) {
      return;
    }

    if (!campaignQuery.data) {
      setTimedMessage({ type: 'error', text: 'Create a campaign before adding Explorer destinations.' });
      return;
    }

    await addDestinationMutation.mutateAsync({
      explorerCampaignId: campaignQuery.data.id,
      sourceUrl: destinationPreview.sourceUrl,
      displayLabel: destinationForm.displayLabel.trim() || null,
    });
  };

  const previewDisplayLabel = destinationForm.displayLabel.trim();

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
          <section className="leaderboard-card explorer-season-summary" data-testid="explorer-season-summary">
            <div>
              <p className="explorer-section-label">Selected season</p>
              <h2>{selectedSeason.name}</h2>
            </div>
            <p className="explorer-season-window">
              {formatUnixDate(selectedSeason.start_at)} to {formatUnixDate(selectedSeason.end_at)}
            </p>
          </section>

          {campaignQuery.isLoading ? (
            <div className="leaderboard-card explorer-card">
              <p>Loading Explorer campaign setup...</p>
            </div>
          ) : campaignQuery.error ? (
            <div className="leaderboard-card explorer-card explorer-error-card">
              <p>{campaignQuery.error.message}</p>
            </div>
          ) : !campaignQuery.data ? (
            <section className="leaderboard-card explorer-card" data-testid="explorer-create-campaign-card">
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
              <section className="leaderboard-card explorer-card" data-testid="explorer-campaign-summary-card">
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

              <section className="leaderboard-card explorer-card" data-testid="explorer-add-destination-card">
                <div className="explorer-card-header">
                  <div>
                    <p className="explorer-section-label">Destination authoring</p>
                    <h3>Add Destination</h3>
                  </div>
                  <p>Paste a Strava segment URL to preview it, then accept or reject before adding it to the campaign.</p>
                </div>

                <div className="explorer-form" data-testid="explorer-add-destination-form">
                  <div className="explorer-form-group">
                    <label htmlFor="explorer-source-url">Strava segment URL</label>
                    <input
                      id="explorer-source-url"
                      data-testid="explorer-source-url-input"
                      value={destinationForm.sourceUrl}
                      onChange={(event) => {
                        setDestinationForm((current) => ({ ...current, sourceUrl: event.target.value }));
                        setDestinationPreview(null);
                        setPreviewError(null);
                      }}
                      onBlur={() => {
                        void requestDestinationPreview();
                      }}
                      onPaste={() => {
                        window.setTimeout(() => {
                          void requestDestinationPreview();
                        }, 0);
                      }}
                      placeholder="https://www.strava.com/segments/2234642"
                      required
                    />
                    <p className="explorer-input-help">
                      Explorer keeps the original source URL and cached display metadata for stable rendering.
                    </p>
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
                      type="button"
                      className="explorer-submit-button"
                      data-testid="explorer-preview-destination-button"
                      disabled={isValidatingPreview || addDestinationMutation.isPending}
                      onClick={() => {
                        void requestDestinationPreview();
                      }}
                    >
                      {isValidatingPreview ? (
                        <>
                          <ArrowPathIcon className="explorer-button-icon explorer-spin" aria-hidden="true" />
                          <span>Validating...</span>
                        </>
                      ) : (
                        <span>Preview Destination</span>
                      )}
                    </button>
                  </div>

                  {previewError && (
                    <p className="explorer-preview-error" data-testid="explorer-preview-error">
                      {previewError}
                    </p>
                  )}

                  {destinationPreview && (
                    <article className="leaderboard-card explorer-preview-card" data-testid="explorer-destination-preview-card">
                      <div className="explorer-card-header explorer-preview-header">
                        <div>
                          <p className="explorer-section-label">Preview</p>
                          <h3 data-testid="explorer-preview-name">{previewDisplayLabel || destinationPreview.name}</h3>
                        </div>
                        <div className="explorer-preview-actions">
                          <button
                            type="button"
                            className="explorer-icon-button explorer-icon-button-accept"
                            data-testid="explorer-accept-preview-button"
                            aria-label="Accept destination preview"
                            onClick={() => {
                              void handleAcceptPreview();
                            }}
                            disabled={addDestinationMutation.isPending}
                          >
                            <CheckIcon aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="explorer-icon-button explorer-icon-button-reject"
                            data-testid="explorer-reject-preview-button"
                            aria-label="Reject destination preview"
                            onClick={() => {
                              setDestinationPreview(null);
                              setPreviewError(null);
                            }}
                          >
                            <XMarkIcon aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      {previewDisplayLabel && (
                        <p className="explorer-preview-subtitle" data-testid="explorer-preview-segment-name">
                          Segment name: {destinationPreview.name}
                        </p>
                      )}

                      <div className="explorer-destination-stats">
                        {formatSegmentDistance(destinationPreview.distance) && (
                          <span className="explorer-stat-pill">{formatSegmentDistance(destinationPreview.distance)}</span>
                        )}
                        {formatAverageGrade(destinationPreview.averageGrade) && (
                          <span className="explorer-stat-pill">{formatAverageGrade(destinationPreview.averageGrade)}</span>
                        )}
                      </div>

                      {formatLocation(destinationPreview.city, destinationPreview.state, destinationPreview.country) && (
                        <p className="explorer-destination-location">
                          <MapPinIcon aria-hidden="true" />
                          <span>{formatLocation(destinationPreview.city, destinationPreview.state, destinationPreview.country)}</span>
                        </p>
                      )}

                      <a
                        className="explorer-destination-link"
                        href={destinationPreview.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span>Open original Strava segment</span>
                        <ArrowTopRightOnSquareIcon aria-hidden="true" />
                      </a>
                    </article>
                  )}
                </div>
              </section>

              <section className="leaderboard-card explorer-card" data-testid="explorer-destination-list-card">
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
                        className="leaderboard-card explorer-destination-card"
                        data-testid={`explorer-destination-row-${destination.id}`}
                      >
                        <div className="explorer-destination-item">
                          <div>
                            <p className="explorer-destination-label">{destination.displayLabel}</p>
                            {destination.customLabel && destination.customLabel !== destination.segmentName ? (
                              <p className="explorer-preview-subtitle">Segment name: {destination.segmentName}</p>
                            ) : null}
                            <p className="explorer-destination-meta">Segment {destination.stravaSegmentId}</p>

                            <div className="explorer-destination-stats">
                              {formatSegmentDistance(destination.distance) && (
                                <span className="explorer-stat-pill">{formatSegmentDistance(destination.distance)}</span>
                              )}
                              {formatAverageGrade(destination.averageGrade) && (
                                <span className="explorer-stat-pill">{formatAverageGrade(destination.averageGrade)}</span>
                              )}
                            </div>

                            {formatLocation(destination.city, destination.state, destination.country) && (
                              <p className="explorer-destination-location">
                                <MapPinIcon aria-hidden="true" />
                                <span>{formatLocation(destination.city, destination.state, destination.country)}</span>
                              </p>
                            )}

                            {destination.sourceUrl ? (
                              <a
                                className="explorer-destination-link"
                                href={destination.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <span>Open original Strava segment</span>
                                <ArrowTopRightOnSquareIcon aria-hidden="true" />
                              </a>
                            ) : null}
                          </div>
                          <span className="explorer-destination-order">#{destination.displayOrder + 1}</span>
                        </div>
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