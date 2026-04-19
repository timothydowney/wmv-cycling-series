import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  CalendarDaysIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { trpc } from '../utils/trpc';
import {
  dateToUnixEnd,
  dateToUnixStart,
  formatUnixDate,
  formatUtcIsoDateTime,
  unixToDateLocal,
} from '../utils/dateUtils';
import './AdminPanel.css';
import './Card.css';
import './ExplorerAdminPanel.css';

interface ExplorerAdminPanelProps {
  isAdmin: boolean;
}

interface FlashMessage {
  type: 'success' | 'error' | 'info';
  text: string;
}

interface CampaignFormState {
  displayName: string;
  rulesBlurb: string;
  startDate: string;
  endDate: string;
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

interface AdminCampaignDestination {
  id: number;
  displayLabel: string;
  customLabel: string | null;
  segmentName: string;
  displayOrder: number;
  sourceUrl: string | null;
  stravaSegmentId: string;
  createdAt: string | null;
  distance: number | null;
  averageGrade: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
}

interface AdminCampaign {
  id: number;
  name: string;
  displayNameRaw: string | null;
  startAt: number;
  endAt: number;
  rulesBlurb: string | null;
  destinations: AdminCampaignDestination[];
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

function getDestinationStatItems({
  distance,
  averageGrade,
  city,
  state,
  country,
}: {
  distance?: number | null;
  averageGrade?: number | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}): string[] {
  const statItems: string[] = [];
  const distanceLabel = formatSegmentDistance(distance);
  const averageGradeLabel = formatAverageGrade(averageGrade);
  const locationLabel = formatLocation(city, state, country);

  if (distanceLabel) {
    statItems.push(distanceLabel);
  }

  if (averageGradeLabel) {
    statItems.push(averageGradeLabel);
  }

  if (locationLabel) {
    statItems.push(locationLabel);
  }

  return statItems;
}

function createEmptyCampaignForm(): CampaignFormState {
  return {
    displayName: '',
    rulesBlurb: '',
    startDate: '',
    endDate: '',
  };
}

function createCampaignFormFromRecord(campaign: AdminCampaign): CampaignFormState {
  return {
    displayName: campaign.displayNameRaw ?? '',
    rulesBlurb: campaign.rulesBlurb ?? '',
    startDate: unixToDateLocal(campaign.startAt),
    endDate: unixToDateLocal(campaign.endAt),
  };
}

function getCampaignStatus(campaign: AdminCampaign, nowTimestamp: number): 'active' | 'upcoming' | 'completed' {
  if (campaign.startAt <= nowTimestamp && campaign.endAt >= nowTimestamp) {
    return 'active';
  }

  if (campaign.startAt > nowTimestamp) {
    return 'upcoming';
  }

  return 'completed';
}

function getCampaignStatusLabel(status: 'active' | 'upcoming' | 'completed'): string {
  if (status === 'active') {
    return 'Active now';
  }

  if (status === 'upcoming') {
    return 'Upcoming';
  }

  return 'Completed';
}

function getPrimaryCampaign(campaigns: AdminCampaign[], nowTimestamp: number): AdminCampaign | null {
  const activeCampaign = campaigns.find((campaign) => getCampaignStatus(campaign, nowTimestamp) === 'active');
  if (activeCampaign) {
    return activeCampaign;
  }

  const upcomingCampaigns = campaigns
    .filter((campaign) => campaign.startAt > nowTimestamp)
    .sort((left, right) => left.startAt - right.startAt || left.id - right.id);

  return upcomingCampaigns[0] ?? null;
}

function ExplorerAdminPanel({ isAdmin }: ExplorerAdminPanelProps) {
  const utils = trpc.useUtils();
  const messageTimeoutRef = useRef<number | null>(null);
  const previewRequestIdRef = useRef(0);
  const hasInitializedExpandedCampaignRef = useRef(false);
  const nowTimestamp = Math.floor(Date.now() / 1000);

  const [createForm, setCreateForm] = useState<CampaignFormState>(() => createEmptyCampaignForm());
  const [campaignForms, setCampaignForms] = useState<Record<number, CampaignFormState>>({});
  const [destinationSourceByCampaign, setDestinationSourceByCampaign] = useState<Record<number, string>>({});
  const [destinationPreview, setDestinationPreview] = useState<PreviewDestination | null>(null);
  const [previewCampaignId, setPreviewCampaignId] = useState<number | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isValidatingPreview, setIsValidatingPreview] = useState(false);
  const [expandedCampaignId, setExpandedCampaignId] = useState<number | null>(null);
  const [expandedMetadataCampaignId, setExpandedMetadataCampaignId] = useState<number | null>(null);
  const [expandedDestinationId, setExpandedDestinationId] = useState<number | null>(null);
  const [message, setMessage] = useState<FlashMessage | null>(null);

  useEffect(() => {
    return () => {
      if (messageTimeoutRef.current !== null) {
        window.clearTimeout(messageTimeoutRef.current);
      }
    };
  }, []);

  const campaignsQuery = trpc.explorerAdmin.getCampaigns.useQuery(undefined, {
    enabled: isAdmin,
    refetchOnWindowFocus: false,
  });

  const campaigns = useMemo(() => (campaignsQuery.data ?? []) as AdminCampaign[], [campaignsQuery.data]);
  const primaryCampaign = useMemo(() => getPrimaryCampaign(campaigns, nowTimestamp), [campaigns, nowTimestamp]);
  const orderedCampaigns = useMemo(() => {
    if (!primaryCampaign) {
      return campaigns;
    }

    return [primaryCampaign, ...campaigns.filter((campaign) => campaign.id !== primaryCampaign.id)];
  }, [campaigns, primaryCampaign]);

  useEffect(() => {
    if (orderedCampaigns.length === 0) {
      hasInitializedExpandedCampaignRef.current = false;
      return;
    }

    if (expandedCampaignId != null && orderedCampaigns.some((campaign) => campaign.id === expandedCampaignId)) {
      hasInitializedExpandedCampaignRef.current = true;
      return;
    }

    if (!hasInitializedExpandedCampaignRef.current) {
      setExpandedCampaignId(orderedCampaigns[0].id);
      hasInitializedExpandedCampaignRef.current = true;
    }
  }, [orderedCampaigns, expandedCampaignId]);

  useEffect(() => {
    if (campaigns.length === 0) {
      setCampaignForms({});
      return;
    }

    setCampaignForms((current) => {
      const next: Record<number, CampaignFormState> = {};

      for (const campaign of campaigns) {
        next[campaign.id] = current[campaign.id] ?? createCampaignFormFromRecord(campaign);
      }

      return next;
    });
  }, [campaigns]);

  const setTimedMessage = (nextMessage: FlashMessage, timeoutMs = 5000) => {
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
    onSuccess: async (campaign) => {
      await utils.explorerAdmin.getCampaigns.invalidate();
      setCreateForm(createEmptyCampaignForm());
      setExpandedCampaignId(campaign.id);
      setTimedMessage({ type: 'success', text: 'Explorer campaign created.' });
    },
    onError: (error) => {
      setTimedMessage({ type: 'error', text: error.message });
    },
  });

  const updateCampaignMutation = trpc.explorerAdmin.updateCampaign.useMutation({
    onSuccess: async () => {
      await utils.explorerAdmin.getCampaigns.invalidate();
      setTimedMessage({ type: 'success', text: 'Explorer campaign updated.' });
    },
    onError: (error) => {
      setTimedMessage({ type: 'error', text: error.message });
    },
  });

  const addDestinationMutation = trpc.explorerAdmin.addDestination.useMutation({
    onSuccess: async (destination) => {
      await utils.explorerAdmin.getCampaigns.invalidate();
      if (previewCampaignId != null) {
        setDestinationSourceByCampaign((current) => ({ ...current, [previewCampaignId]: '' }));
      }
      previewRequestIdRef.current += 1;
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

  const deleteDestinationMutation = trpc.explorerAdmin.deleteDestination.useMutation({
    onSuccess: async ({ explorerDestinationId }) => {
      await utils.explorerAdmin.getCampaigns.invalidate();
      setExpandedDestinationId((current) => current === explorerDestinationId ? null : current);
      setTimedMessage({ type: 'success', text: 'Destination removed from the Explorer campaign.' });
    },
    onError: (error) => {
      setTimedMessage({ type: 'error', text: error.message });
    },
  });

  useEffect(() => {
    const sourceUrl = expandedCampaignId != null ? destinationSourceByCampaign[expandedCampaignId]?.trim() ?? '' : '';

    if (!expandedCampaignId || !sourceUrl) {
      previewRequestIdRef.current += 1;
      setDestinationPreview(null);
      setPreviewError(null);
      setIsValidatingPreview(false);
      return;
    }

    const parsedSegmentId = parseSegmentId(sourceUrl);
    if (!parsedSegmentId) {
      previewRequestIdRef.current += 1;
      setDestinationPreview(null);
      setPreviewCampaignId(expandedCampaignId);
      setPreviewError('Please provide a valid Strava segment URL');
      setIsValidatingPreview(false);
      return;
    }

    const requestId = previewRequestIdRef.current + 1;
    previewRequestIdRef.current = requestId;
    setPreviewCampaignId(expandedCampaignId);
    setIsValidatingPreview(true);
    setPreviewError(null);

    const previewTimeout = window.setTimeout(() => {
      void utils.client.segment.validate.query(parsedSegmentId)
        .then((segment) => {
          if (previewRequestIdRef.current !== requestId) {
            return;
          }

          if (!segment) {
            throw new Error('Segment metadata could not be loaded');
          }

          setDestinationPreview({
            sourceUrl,
            name: segment.name,
            distance: segment.distance,
            averageGrade: segment.average_grade,
            city: segment.city,
            state: segment.state,
            country: segment.country,
          });
        })
        .catch((error: unknown) => {
          if (previewRequestIdRef.current !== requestId) {
            return;
          }

          const errorMessage = error instanceof Error ? error.message : 'Segment metadata could not be loaded';
          setDestinationPreview(null);
          setPreviewError(errorMessage);
        })
        .finally(() => {
          if (previewRequestIdRef.current === requestId) {
            setIsValidatingPreview(false);
          }
        });
    }, 150);

    return () => {
      window.clearTimeout(previewTimeout);
    };
  }, [destinationSourceByCampaign, expandedCampaignId, utils.client.segment.validate]);

  const handleCreateCampaign = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!createForm.startDate || !createForm.endDate) {
      setTimedMessage({ type: 'error', text: 'Enter start and end dates for the Explorer campaign.' });
      return;
    }

    await createCampaignMutation.mutateAsync({
      startAt: dateToUnixStart(createForm.startDate),
      endAt: dateToUnixEnd(createForm.endDate),
      displayName: createForm.displayName.trim() || null,
      rulesBlurb: createForm.rulesBlurb.trim() || null,
    });
  };

  const handleSaveCampaign = async (campaignId: number) => {
    const formState = campaignForms[campaignId];

    if (!formState?.startDate || !formState.endDate) {
      setTimedMessage({ type: 'error', text: 'Enter start and end dates before saving the campaign.' });
      return;
    }

    await updateCampaignMutation.mutateAsync({
      explorerCampaignId: campaignId,
      startAt: dateToUnixStart(formState.startDate),
      endAt: dateToUnixEnd(formState.endDate),
      displayName: formState.displayName.trim() || null,
      rulesBlurb: formState.rulesBlurb.trim() || null,
    });

    setExpandedMetadataCampaignId((current) => current === campaignId ? null : current);
  };

  const handleOpenCampaignEditor = (campaignId: number) => {
    setExpandedCampaignId(campaignId);
    setExpandedMetadataCampaignId(campaignId);
    setPreviewCampaignId(campaignId);
  };

  const handleCancelCampaignEdit = (campaign: AdminCampaign) => {
    setCampaignForms((current) => ({
      ...current,
      [campaign.id]: createCampaignFormFromRecord(campaign),
    }));
    setExpandedMetadataCampaignId((current) => current === campaign.id ? null : current);
  };

  const handleAcceptPreview = async () => {
    if (!destinationPreview || previewCampaignId == null) {
      return;
    }

    await addDestinationMutation.mutateAsync({
      explorerCampaignId: previewCampaignId,
      sourceUrl: destinationPreview.sourceUrl,
    });
  };

  const handleDeleteDestination = async (destinationId: number, destinationLabel: string) => {
    if (!window.confirm(`Remove ${destinationLabel} from this Explorer campaign?`)) {
      return;
    }

    try {
      await deleteDestinationMutation.mutateAsync({ explorerDestinationId: destinationId });
    } catch {
      // Mutation error UI is already handled by the mutation onError callback.
    }
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
      {message ? (
        <div className={`explorer-message ${message.type}`} data-testid="explorer-admin-message">
          {message.text}
        </div>
      ) : null}

      <section className="leaderboard-card explorer-card explorer-admin-hero" data-testid="explorer-admin-hero">
        <div>
          <p className="explorer-section-label">Explorer admin</p>
          <h2>Campaign editor</h2>
        </div>
        <p className="explorer-muted-copy">
          Explorer campaigns now manage their own date windows. Create one campaign at a time, keep date ranges non-overlapping, and add destinations directly inside the active card.
        </p>
      </section>

      {!primaryCampaign ? (
        <section className="leaderboard-card explorer-card explorer-create-shell" data-testid="explorer-create-campaign-card">
        <div className="explorer-card-header">
          <div>
            <p className="explorer-section-label">New campaign</p>
            <h3>Create Explorer Campaign</h3>
          </div>
          <p>Start the next Explorer campaign with its own dates, then add destinations inside the campaign card below.</p>
        </div>

        <form
          className="explorer-form"
          data-testid="explorer-create-campaign-form"
          onSubmit={(event) => {
            void handleCreateCampaign(event);
          }}
        >
          <div className="explorer-form-grid">
            <div className="explorer-form-group">
              <label htmlFor="explorer-display-name">Display name</label>
              <input
                id="explorer-display-name"
                data-testid="explorer-display-name-input"
                value={createForm.displayName}
                onChange={(event) => {
                  setCreateForm((current) => ({ ...current, displayName: event.target.value }));
                }}
                placeholder="Optional campaign name"
                maxLength={255}
              />
            </div>

            <div className="explorer-form-group">
              <label htmlFor="explorer-start-date">Start date</label>
              <input
                id="explorer-start-date"
                data-testid="explorer-start-date-input"
                type="date"
                value={createForm.startDate}
                onChange={(event) => {
                  setCreateForm((current) => ({ ...current, startDate: event.target.value }));
                }}
                required
              />
            </div>

            <div className="explorer-form-group">
              <label htmlFor="explorer-end-date">End date</label>
              <input
                id="explorer-end-date"
                data-testid="explorer-end-date-input"
                type="date"
                value={createForm.endDate}
                onChange={(event) => {
                  setCreateForm((current) => ({ ...current, endDate: event.target.value }));
                }}
                required
              />
            </div>
          </div>

          <div className="explorer-form-group">
            <label htmlFor="explorer-rules-blurb">Rules blurb</label>
            <textarea
              id="explorer-rules-blurb"
              data-testid="explorer-rules-blurb-input"
              value={createForm.rulesBlurb}
              onChange={(event) => {
                setCreateForm((current) => ({ ...current, rulesBlurb: event.target.value }));
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
      ) : null}

      {campaignsQuery.isLoading ? (
        <section className="leaderboard-card explorer-card">
          <p className="explorer-muted-copy">Loading Explorer campaigns...</p>
        </section>
      ) : campaigns.length === 0 ? (
        <section className="leaderboard-card explorer-card" data-testid="explorer-empty-state">
          <h3>No Explorer campaigns yet</h3>
          <p className="explorer-muted-copy">Create the first campaign above to begin destination authoring.</p>
        </section>
      ) : (
        <section className="explorer-campaign-stack" data-testid="explorer-campaign-stack">
          {orderedCampaigns.map((campaign, campaignIndex) => {
            const isExpanded = expandedCampaignId === campaign.id;
            const campaignForm = campaignForms[campaign.id] ?? createCampaignFormFromRecord(campaign);
            const destinationSource = destinationSourceByCampaign[campaign.id] ?? '';
            const destinationPreviewVisible = previewCampaignId === campaign.id ? destinationPreview : null;
            const previewErrorVisible = previewCampaignId === campaign.id ? previewError : null;
            const isPreviewLoading = previewCampaignId === campaign.id && isValidatingPreview;
            const status = getCampaignStatus(campaign, nowTimestamp);
            const isPrimaryCampaign = primaryCampaign?.id === campaign.id;
            const isMetadataExpanded = expandedMetadataCampaignId === campaign.id;
            const sortedDestinations = [...campaign.destinations]
              .sort((left, right) => left.displayOrder - right.displayOrder || left.id - right.id);

            return (
              <article
                key={campaign.id}
                className={`leaderboard-card explorer-card explorer-campaign-shell${isPrimaryCampaign ? ' explorer-primary-campaign-shell' : ''}`}
                data-testid={`explorer-campaign-card-${campaign.id}`}
              >
                {isPrimaryCampaign ? (
                  <p className="explorer-section-label explorer-section-label-inline" data-testid="explorer-primary-campaign-label">
                    {status === 'active' ? 'Current campaign' : 'Next campaign'}
                  </p>
                ) : campaignIndex === 1 ? (
                  <p className="explorer-section-label explorer-section-label-inline">Other campaigns</p>
                ) : null}
                <div className="explorer-campaign-summary-row">
                  <button
                    type="button"
                    className="explorer-campaign-toggle"
                    data-testid={`explorer-campaign-toggle-${campaign.id}`}
                    aria-expanded={isExpanded}
                    onClick={() => {
                      setExpandedCampaignId((current) => current === campaign.id ? null : campaign.id);
                      setPreviewCampaignId(campaign.id);
                      setDestinationPreview(null);
                      setPreviewError(null);
                    }}
                  >
                    <div className="explorer-campaign-toggle-main">
                      <div>
                        <p
                          className="explorer-campaign-name-kicker"
                          data-testid={isPrimaryCampaign ? 'explorer-campaign-name' : undefined}
                        >
                          {campaign.name}
                        </p>
                      </div>
                      <div className="explorer-chip-cluster">
                        <span className={`week-header-chip explorer-status-chip explorer-status-${status}`}>
                          {getCampaignStatusLabel(status)}
                        </span>
                        <span className="week-header-chip">
                          <CalendarDaysIcon className="explorer-chip-icon" aria-hidden="true" />
                          {formatUnixDate(campaign.startAt, { month: 'short', day: 'numeric', year: 'numeric' })} to {formatUnixDate(campaign.endAt, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <span className="week-header-chip">{campaign.destinations.length} destination{campaign.destinations.length === 1 ? '' : 's'}</span>
                      </div>
                    </div>
                  </button>

                  <div className="explorer-summary-actions">
                    <button
                      type="button"
                      className="explorer-icon-button explorer-icon-button-summary"
                      data-testid={`explorer-edit-campaign-button-${campaign.id}`}
                      aria-label={`Edit ${campaign.name}`}
                      onClick={() => {
                        handleOpenCampaignEditor(campaign.id);
                      }}
                    >
                      <PencilSquareIcon aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="explorer-icon-button explorer-icon-button-summary"
                      data-testid={`explorer-campaign-summary-caret-${campaign.id}`}
                      aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${campaign.name}`}
                      aria-expanded={isExpanded}
                      onClick={() => {
                        setExpandedCampaignId((current) => current === campaign.id ? null : campaign.id);
                        setPreviewCampaignId(campaign.id);
                        setDestinationPreview(null);
                        setPreviewError(null);
                      }}
                    >
                      <ChevronDownIcon className={`explorer-destination-chevron${isExpanded ? ' is-expanded' : ''}`} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {isExpanded ? (
                  <div className="card-expanded-details explorer-campaign-details">
                    {isMetadataExpanded ? (
                      <section className="explorer-campaign-editor-block explorer-campaign-editing-block" data-testid={`explorer-campaign-edit-form-${campaign.id}`}>
                        <div className="explorer-card-header">
                          <div>
                            <p className="explorer-section-label">Campaign editing</p>
                            <h4>Edit campaign details</h4>
                          </div>
                          <p>Update the campaign name, dates, or rules before you go back to destination work.</p>
                        </div>

                        <div className="explorer-form explorer-form-tight">
                          <div className="explorer-form-grid">
                            <div className="explorer-form-group">
                              <label htmlFor={`explorer-campaign-name-${campaign.id}`}>Display name</label>
                              <input
                                id={`explorer-campaign-name-${campaign.id}`}
                                data-testid={`explorer-campaign-name-input-${campaign.id}`}
                                value={campaignForm.displayName}
                                onChange={(event) => {
                                  setCampaignForms((current) => ({
                                    ...current,
                                    [campaign.id]: { ...campaignForm, displayName: event.target.value },
                                  }));
                                }}
                                placeholder="Optional campaign name"
                                maxLength={255}
                              />
                            </div>

                            <div className="explorer-form-group">
                              <label htmlFor={`explorer-campaign-start-${campaign.id}`}>Start date</label>
                              <input
                                id={`explorer-campaign-start-${campaign.id}`}
                                data-testid={`explorer-campaign-start-date-input-${campaign.id}`}
                                type="date"
                                value={campaignForm.startDate}
                                onChange={(event) => {
                                  setCampaignForms((current) => ({
                                    ...current,
                                    [campaign.id]: { ...campaignForm, startDate: event.target.value },
                                  }));
                                }}
                              />
                            </div>

                            <div className="explorer-form-group">
                              <label htmlFor={`explorer-campaign-end-${campaign.id}`}>End date</label>
                              <input
                                id={`explorer-campaign-end-${campaign.id}`}
                                data-testid={`explorer-campaign-end-date-input-${campaign.id}`}
                                type="date"
                                value={campaignForm.endDate}
                                onChange={(event) => {
                                  setCampaignForms((current) => ({
                                    ...current,
                                    [campaign.id]: { ...campaignForm, endDate: event.target.value },
                                  }));
                                }}
                              />
                            </div>
                          </div>

                          <div className="explorer-form-group">
                            <label htmlFor={`explorer-campaign-rules-${campaign.id}`}>Rules blurb</label>
                            <textarea
                              id={`explorer-campaign-rules-${campaign.id}`}
                              data-testid={`explorer-campaign-rules-input-${campaign.id}`}
                              value={campaignForm.rulesBlurb}
                              onChange={(event) => {
                                setCampaignForms((current) => ({
                                  ...current,
                                  [campaign.id]: { ...campaignForm, rulesBlurb: event.target.value },
                                }));
                              }}
                              rows={4}
                              maxLength={2000}
                            />
                          </div>

                          <div className="explorer-form-actions">
                            <button
                              type="button"
                              className="explorer-secondary-button"
                              data-testid={`explorer-cancel-campaign-button-${campaign.id}`}
                              onClick={() => {
                                handleCancelCampaignEdit(campaign);
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="explorer-submit-button"
                              data-testid={`explorer-save-campaign-button-${campaign.id}`}
                              onClick={() => {
                                void handleSaveCampaign(campaign.id);
                              }}
                              disabled={updateCampaignMutation.isPending}
                            >
                              {updateCampaignMutation.isPending ? 'Saving...' : 'Save Campaign'}
                            </button>
                          </div>
                        </div>
                      </section>
                    ) : null}

                    <section className="explorer-campaign-editor-block explorer-destination-authoring-block" data-testid="explorer-add-destination-card">
                      <div className="explorer-card-header">
                        <div>
                          <p className="explorer-section-label">Destination authoring</p>
                          <h4>Add destination</h4>
                        </div>
                        <p>Paste a Strava segment URL and Explorer will validate it into a preview automatically.</p>
                      </div>

                      <div className="explorer-form explorer-form-tight">
                        <div className="explorer-form-group">
                            <input
                              id={`explorer-source-url-${campaign.id}`}
                              data-testid="explorer-source-url-input"
                              value={destinationSource}
                              onChange={(event) => {
                                const nextValue = event.target.value;
                                setPreviewCampaignId(campaign.id);
                                setDestinationSourceByCampaign((current) => ({ ...current, [campaign.id]: nextValue }));
                                setDestinationPreview(null);
                                setPreviewError(null);
                              }}
                              placeholder="https://www.strava.com/segments/2234642"
                              aria-label="Strava segment URL"
                              required
                            />
                            <p className="explorer-input-help">
                              Explorer keeps the original Strava URL and previews the segment automatically as you paste.
                            </p>
                        </div>

                        {isPreviewLoading ? (
                          <p className="explorer-preview-status" data-testid="explorer-preview-status">
                            <ArrowPathIcon className="explorer-button-icon explorer-spin" aria-hidden="true" />
                            <span>Validating segment...</span>
                          </p>
                        ) : null}

                        {previewErrorVisible ? (
                          <p className="explorer-preview-error" data-testid="explorer-preview-error">
                            {previewErrorVisible}
                          </p>
                        ) : null}

                        {destinationPreviewVisible ? (
                          (() => {
                            const previewStatItems = getDestinationStatItems(destinationPreviewVisible);

                            return (
                              <article className="explorer-preview-card" data-testid="explorer-destination-preview-card">
                                <div className="explorer-preview-header">
                                  <p className="explorer-section-label">Preview</p>
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
                                        previewRequestIdRef.current += 1;
                                        setDestinationPreview(null);
                                        setPreviewError(null);
                                      }}
                                    >
                                      <XMarkIcon aria-hidden="true" />
                                    </button>
                                  </div>
                                </div>

                                <div className="explorer-destination-surface explorer-destination-surface-preview">
                                  <h4 className="explorer-destination-hero-title" data-testid="explorer-preview-name">
                                    <a
                                      className="explorer-destination-surface-link"
                                      href={destinationPreviewVisible.sourceUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      {destinationPreviewVisible.name}
                                      <ArrowTopRightOnSquareIcon aria-hidden="true" />
                                    </a>
                                  </h4>

                                  {previewStatItems.length > 0 ? (
                                    <div className="explorer-destination-chip-row">
                                      {previewStatItems.map((item) => (
                                        <span key={item} className="week-header-chip">{item}</span>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              </article>
                            );
                          })()
                        ) : null}
                      </div>
                    </section>

                    <section className="explorer-destination-section" data-testid="explorer-destination-list-card">
                      <div className="explorer-card-header">
                        <div>
                          <p className="explorer-section-label">Current campaign map</p>
                          <h4>Destinations</h4>
                        </div>
                      </div>

                      <div className="explorer-search-stub" data-testid={`explorer-destination-search-stub-${campaign.id}`}>
                        <div className="explorer-search-stub-input">
                          <MagnifyingGlassIcon aria-hidden="true" />
                          <input
                            id={`explorer-destination-search-${campaign.id}`}
                            type="text"
                            placeholder="Filter by label, segment name, or location already in this campaign"
                            disabled
                          />
                        </div>
                      </div>

                      {sortedDestinations.length === 0 ? (
                        <p className="explorer-muted-copy">No destinations added yet.</p>
                      ) : (
                        <ol className="explorer-destination-list" data-testid="explorer-destination-list">
                          {sortedDestinations.map((destination) => {
                            const isDestinationExpanded = expandedDestinationId === destination.id;
                            const createdAtLabel = formatDestinationCreatedAt(destination.createdAt);
                            const destinationStatItems = getDestinationStatItems({
                              distance: destination.distance,
                              averageGrade: destination.averageGrade,
                              city: destination.city,
                              state: destination.state,
                              country: destination.country,
                            });

                            return (
                              <li
                                key={destination.id}
                                className="explorer-destination-card"
                                data-expanded={isDestinationExpanded}
                                data-testid={`explorer-destination-row-${destination.id}`}
                              >
                                <div className="explorer-destination-summary">
                                  <div className="explorer-destination-surface explorer-destination-summary-card">
                                    <div>
                                      <h5 className="explorer-destination-hero-title explorer-destination-list-title">
                                        {destination.sourceUrl ? (
                                          <a
                                            className="explorer-destination-surface-link"
                                            href={destination.sourceUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                          >
                                            {destination.displayLabel}
                                            <ArrowTopRightOnSquareIcon aria-hidden="true" />
                                          </a>
                                        ) : (
                                          <span className="explorer-destination-label">{destination.displayLabel}</span>
                                        )}
                                      </h5>

                                      {destinationStatItems.length > 0 ? (
                                        <div className="explorer-destination-chip-row">
                                          {destinationStatItems.map((item) => (
                                            <span key={item} className="week-header-chip">{item}</span>
                                          ))}
                                        </div>
                                      ) : null}
                                    </div>

                                    <div className="explorer-destination-actions">
                                      <button
                                        type="button"
                                        className="explorer-icon-button explorer-icon-button-delete"
                                        data-testid={`explorer-delete-destination-button-${destination.id}`}
                                        aria-label={`Delete ${destination.displayLabel}`}
                                        disabled={deleteDestinationMutation.isPending}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          void handleDeleteDestination(destination.id, destination.displayLabel);
                                        }}
                                      >
                                        <TrashIcon aria-hidden="true" />
                                      </button>
                                      <button
                                        type="button"
                                        className="explorer-icon-button explorer-icon-button-summary"
                                        data-testid={`explorer-destination-toggle-${destination.id}`}
                                        aria-label={`${isDestinationExpanded ? 'Collapse' : 'Expand'} ${destination.displayLabel}`}
                                        aria-expanded={isDestinationExpanded}
                                        onClick={() => {
                                          setExpandedDestinationId((current) => current === destination.id ? null : destination.id);
                                        }}
                                      >
                                        <ChevronDownIcon className={`explorer-destination-chevron${isDestinationExpanded ? ' is-expanded' : ''}`} aria-hidden="true" />
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {isDestinationExpanded ? (
                                  <div className="card-expanded-details explorer-destination-details">
                                    <div className="explorer-destination-detail-block">
                                      <p className="explorer-detail-label">Details</p>

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
                                  </div>
                                ) : null}
                              </li>
                            );
                          })}
                        </ol>
                      )}
                    </section>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      )}

      {primaryCampaign ? (
        <section className="leaderboard-card explorer-card explorer-create-shell explorer-create-shell-secondary" data-testid="explorer-create-campaign-card">
          <div className="explorer-card-header">
            <div>
              <p className="explorer-section-label">Plan ahead</p>
              <h3>Create Another Campaign</h3>
            </div>
            <p>Set up the next non-overlapping campaign after you finish the current destination work.</p>
          </div>

          <form
            className="explorer-form"
            data-testid="explorer-create-campaign-form"
            onSubmit={(event) => {
              void handleCreateCampaign(event);
            }}
          >
            <div className="explorer-form-grid">
              <div className="explorer-form-group">
                <label htmlFor="explorer-display-name-secondary">Display name</label>
                <input
                  id="explorer-display-name-secondary"
                  data-testid="explorer-display-name-input"
                  value={createForm.displayName}
                  onChange={(event) => {
                    setCreateForm((current) => ({ ...current, displayName: event.target.value }));
                  }}
                  placeholder="Optional campaign name"
                  maxLength={255}
                />
              </div>

              <div className="explorer-form-group">
                <label htmlFor="explorer-start-date-secondary">Start date</label>
                <input
                  id="explorer-start-date-secondary"
                  data-testid="explorer-start-date-input"
                  type="date"
                  value={createForm.startDate}
                  onChange={(event) => {
                    setCreateForm((current) => ({ ...current, startDate: event.target.value }));
                  }}
                  required
                />
              </div>

              <div className="explorer-form-group">
                <label htmlFor="explorer-end-date-secondary">End date</label>
                <input
                  id="explorer-end-date-secondary"
                  data-testid="explorer-end-date-input"
                  type="date"
                  value={createForm.endDate}
                  onChange={(event) => {
                    setCreateForm((current) => ({ ...current, endDate: event.target.value }));
                  }}
                  required
                />
              </div>
            </div>

            <div className="explorer-form-group">
              <label htmlFor="explorer-rules-blurb-secondary">Rules blurb</label>
              <textarea
                id="explorer-rules-blurb-secondary"
                data-testid="explorer-rules-blurb-input"
                value={createForm.rulesBlurb}
                onChange={(event) => {
                  setCreateForm((current) => ({ ...current, rulesBlurb: event.target.value }));
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
      ) : null}
    </div>
  );
}

export default ExplorerAdminPanel;
