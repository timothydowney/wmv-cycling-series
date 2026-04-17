import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowPathIcon,
  ChevronDownIcon,
  CheckIcon,
  ClockIcon,
  MapPinIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import type { Season } from '../types';
import { trpc } from '../utils/trpc';
import { formatUnixDate, formatUtcIsoDateTime } from '../utils/dateUtils';
import SeasonSelector from './SeasonSelector';
import './AdminPanel.css';
import './Card.css';
import './SegmentCard.css';
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

function formatDestinationCreatedAt(createdAt?: string | null): string | null {
  if (!createdAt) {
    return null;
  }

  const formatted = formatUtcIsoDateTime(createdAt);
  return formatted === '—' ? null : formatted.replace(/,\s+\d{1,2}:\d{2}:\d{2}\s+[AP]M$/, '');
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
  const [destinationForm, setDestinationForm] = useState({ sourceUrl: '' });
  const [destinationPreview, setDestinationPreview] = useState<PreviewDestination | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isValidatingPreview, setIsValidatingPreview] = useState(false);
  const [expandedDestinationId, setExpandedDestinationId] = useState<number | null>(null);
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
      setDestinationForm({ sourceUrl: '' });
      setDestinationPreview(null);
      setPreviewError(null);
      setExpandedDestinationId(destination.id);

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

  const requestDestinationPreview = useCallback(async () => {
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
  }, [destinationForm.sourceUrl, utils.client.segment.validate]);

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
    });
  };

  useEffect(() => {
    if (!campaignQuery.data) {
      return;
    }

    const trimmedSourceUrl = destinationForm.sourceUrl.trim();

    if (!trimmedSourceUrl) {
      setDestinationPreview(null);
      setPreviewError(null);
      return;
    }

    const previewTimeout = window.setTimeout(() => {
      void requestDestinationPreview();
    }, 150);

    return () => {
      window.clearTimeout(previewTimeout);
    };
  }, [campaignQuery.data, destinationForm.sourceUrl, requestDestinationPreview]);

  const sortedDestinations = campaignQuery.data
    ? [...campaignQuery.data.destinations].sort((left, right) => {
        if (left.createdAt && right.createdAt && left.createdAt !== right.createdAt) {
          return right.createdAt.localeCompare(left.createdAt);
        }

        if (left.displayOrder !== right.displayOrder) {
          return right.displayOrder - left.displayOrder;
        }

        return right.id - left.id;
      })
    : [];

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
      {message ? (
        <div className={`explorer-message ${message.type}`} data-testid="explorer-admin-message">
          {message.text}
        </div>
      ) : null}

      {seasons.length > 0 ? (
        <div className="admin-season-selector-wrapper">
          <SeasonSelector
            seasons={seasons}
            selectedSeasonId={resolvedSeasonId}
            setSelectedSeasonId={onSeasonChange}
          />
        </div>
      ) : null}

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
            <section className="leaderboard-card explorer-card">
              <p className="explorer-muted-copy">Loading Explorer campaign…</p>
            </section>
          ) : campaignQuery.data == null ? (
            <section className="leaderboard-card explorer-card" data-testid="explorer-create-campaign-card">
              <div className="explorer-card-header">
                <div>
                  <p className="explorer-section-label">Phase 4B setup</p>
                  <h3>Create Explorer Campaign</h3>
                </div>
                <p>Start with a campaign shell for this season, then add destinations below.</p>
              </div>

              <form className="explorer-form" data-testid="explorer-create-campaign-form" onSubmit={(event) => {
                void handleCreateCampaign(event);
              }}>
                <div className="explorer-form-group">
                  <label htmlFor="explorer-display-name">Display name</label>
                  <input
                    id="explorer-display-name"
                    data-testid="explorer-display-name-input"
                    value={campaignForm.displayName}
                    onChange={(event) => {
                      setCampaignForm((current) => ({ ...current, displayName: event.target.value }));
                    }}
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
                    onChange={(event) => {
                      setCampaignForm((current) => ({ ...current, rulesBlurb: event.target.value }));
                    }}
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
                  <p>
                    {campaignQuery.data.destinations.length} destination{campaignQuery.data.destinations.length === 1 ? '' : 's'}
                  </p>
                </div>

                {campaignQuery.data.rulesBlurb ? (
                  <p className="explorer-rules-blurb" data-testid="explorer-campaign-rules-blurb">
                    {campaignQuery.data.rulesBlurb}
                  </p>
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
                  <p>Paste a Strava segment URL and Explorer will validate it into a quick add preview automatically.</p>
                </div>

                <div className="explorer-form" data-testid="explorer-add-destination-form">
                  <div className="explorer-form-group">
                    <label htmlFor="explorer-source-url">Strava segment URL</label>
                    <input
                      id="explorer-source-url"
                      data-testid="explorer-source-url-input"
                      value={destinationForm.sourceUrl}
                      onChange={(event) => {
                        setDestinationForm({ sourceUrl: event.target.value });
                        setDestinationPreview(null);
                        setPreviewError(null);
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
                      Explorer keeps the original Strava URL and previews the segment automatically as you paste.
                    </p>
                  </div>

                  {isValidatingPreview ? (
                    <p className="explorer-preview-status" data-testid="explorer-preview-status">
                      <ArrowPathIcon className="explorer-button-icon explorer-spin" aria-hidden="true" />
                      <span>Validating segment...</span>
                    </p>
                  ) : null}

                  {previewError ? (
                    <p className="explorer-preview-error" data-testid="explorer-preview-error">
                      {previewError}
                    </p>
                  ) : null}

                  {destinationPreview ? (
                    <article className="leaderboard-card explorer-preview-card" data-testid="explorer-destination-preview-card">
                      <div className="explorer-card-header explorer-preview-header">
                        <div>
                          <p className="explorer-section-label">Preview</p>
                          <h3 className="explorer-destination-heading" data-testid="explorer-preview-name">
                            <a
                              className="segment-link explorer-destination-name-link"
                              href={destinationPreview.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {destinationPreview.name}
                            </a>
                          </h3>
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

                      <div className="explorer-destination-chips">
                        {formatSegmentDistance(destinationPreview.distance) ? (
                          <span className="week-header-chip">{formatSegmentDistance(destinationPreview.distance)}</span>
                        ) : null}
                        {formatAverageGrade(destinationPreview.averageGrade) ? (
                          <span className="week-header-chip">{formatAverageGrade(destinationPreview.averageGrade)}</span>
                        ) : null}
                        {formatLocation(destinationPreview.city, destinationPreview.state, destinationPreview.country) ? (
                          <span className="week-header-chip explorer-location-chip">
                            <MapPinIcon className="week-header-chip-icon" aria-hidden="true" />
                            <span>{formatLocation(destinationPreview.city, destinationPreview.state, destinationPreview.country)}</span>
                          </span>
                        ) : null}
                      </div>
                    </article>
                  ) : null}
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
                    {sortedDestinations.map((destination) => {
                      const isExpanded = expandedDestinationId === destination.id;
                      const createdAtLabel = formatDestinationCreatedAt(destination.createdAt);
                      const locationLabel = formatLocation(destination.city, destination.state, destination.country);

                      return (
                        <li
                          key={destination.id}
                          className="leaderboard-card explorer-destination-card"
                          data-expanded={isExpanded}
                          data-testid={`explorer-destination-row-${destination.id}`}
                        >
                          <div
                            role="button"
                            tabIndex={0}
                            className="explorer-destination-summary"
                            onClick={() => {
                              setExpandedDestinationId((current) => current === destination.id ? null : destination.id);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                setExpandedDestinationId((current) => current === destination.id ? null : destination.id);
                              }
                            }}
                            aria-expanded={isExpanded}
                            data-testid={`explorer-destination-toggle-${destination.id}`}
                          >
                            <div className="explorer-destination-item">
                              <div>
                                <h4 className="explorer-destination-heading">
                                  {destination.sourceUrl ? (
                                    <a
                                      className="segment-link explorer-destination-name-link"
                                      href={destination.sourceUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                      }}
                                    >
                                      {destination.displayLabel}
                                    </a>
                                  ) : (
                                    <span className="explorer-destination-label">{destination.displayLabel}</span>
                                  )}
                                </h4>

                                <div className="explorer-destination-chips">
                                  {formatSegmentDistance(destination.distance) ? (
                                    <span className="week-header-chip">{formatSegmentDistance(destination.distance)}</span>
                                  ) : null}
                                  {formatAverageGrade(destination.averageGrade) ? (
                                    <span className="week-header-chip">{formatAverageGrade(destination.averageGrade)}</span>
                                  ) : null}
                                  {locationLabel ? (
                                    <span className="week-header-chip explorer-location-chip">
                                      <MapPinIcon className="week-header-chip-icon" aria-hidden="true" />
                                      <span>{locationLabel}</span>
                                    </span>
                                  ) : null}
                                </div>
                              </div>

                              <ChevronDownIcon className={`explorer-destination-chevron${isExpanded ? ' is-expanded' : ''}`} aria-hidden="true" />
                            </div>
                          </div>

                          {isExpanded ? (
                            <div className="card-expanded-details explorer-destination-details">
                              {destination.customLabel && destination.customLabel !== destination.segmentName ? (
                                <p className="explorer-preview-subtitle">Original segment name: {destination.segmentName}</p>
                              ) : null}

                              <div className="explorer-destination-detail-row">
                                {createdAtLabel ? (
                                  <p className="explorer-destination-meta">
                                    <ClockIcon aria-hidden="true" />
                                    <span>Added {createdAtLabel}</span>
                                  </p>
                                ) : (
                                  <p className="explorer-muted-copy">Added date unavailable.</p>
                                )}
                              </div>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
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