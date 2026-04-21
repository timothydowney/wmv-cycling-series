import { useDeferredValue, useId, useMemo, useState } from 'react';
import {
  ArrowTopRightOnSquareIcon,
  BookmarkIcon,
  CalendarDaysIcon,
  CheckBadgeIcon,
  CheckCircleIcon,
  ClockIcon,
  FlagIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
import { trpc } from '../utils/trpc';
import { formatUnixDate } from '../utils/dateUtils';
import { useUnits } from '../context/UnitContext';
import { formatDistance, type UnitSystem } from '../utils/unitConversion';
import ExplorerBottomNav from './ExplorerBottomNav';
import './Card.css';
import './ExplorerHubPage.css';

interface ExplorerHubPageProps {
  isAdmin: boolean;
  isConnected: boolean;
}

interface ExplorerDestinationSummary {
  id: number;
  stravaSegmentId: string;
  displayOrder: number;
  displayLabel: string;
  customLabel: string | null;
  segmentName: string;
  sourceUrl: string | null;
  distance: number | null;
  averageGrade: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
}

interface ExplorerProgressDestinationSummary extends ExplorerDestinationSummary {
  completed: boolean;
  pinned: boolean;
  matchedAt: number | null;
  stravaActivityId: string | null;
}

type ExplorerTab = 'hub' | 'destinations';
type DestinationFilter = 'all' | 'remaining' | 'completed';

const DEFAULT_REMAINING_VISIBLE = 10;
const DEFAULT_COMPLETED_VISIBLE = 10;
const EMPTY_DESTINATIONS: ExplorerDestinationSummary[] = [];

function formatAverageGrade(averageGrade: number | null | undefined): string | null {
  if (averageGrade == null) {
    return null;
  }

  return `${averageGrade.toFixed(1)}% avg grade`;
}

function formatLocation(city?: string | null, state?: string | null, country?: string | null): string | null {
  const locationParts = [city, state, country].filter(Boolean);
  return locationParts.length > 0 ? locationParts.join(', ') : null;
}

function getDestinationChips(destination: ExplorerDestinationSummary, units: UnitSystem): string[] {
  const chips: string[] = [];
  const distance = destination.distance != null ? formatDistance(destination.distance, units) : null;
  const grade = formatAverageGrade(destination.averageGrade);
  const location = formatLocation(destination.city, destination.state, destination.country);

  if (distance) {
    chips.push(distance);
  }

  if (grade) {
    chips.push(grade);
  }

  if (location) {
    chips.push(location);
  }

  return chips;
}

function matchesDestinationSearch(destination: ExplorerProgressDestinationSummary, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  const location = formatLocation(destination.city, destination.state, destination.country);
  const searchableParts = [
    destination.displayLabel,
    destination.customLabel,
    destination.segmentName,
    location,
  ].filter((part): part is string => Boolean(part));

  return searchableParts.some((part) => part.toLowerCase().includes(normalizedQuery));
}

function ExplorerDestinationCard({
  destination,
  completed,
  pinned,
  matchedAt,
  showPinAction = false,
  pinDisabled = false,
  onTogglePin,
}: {
  destination: ExplorerDestinationSummary;
  completed: boolean;
  pinned: boolean;
  matchedAt: number | null;
  showPinAction?: boolean;
  pinDisabled?: boolean;
  onTogglePin?: (destinationId: number, pinned: boolean) => void | Promise<void>;
}) {
  const { units } = useUnits();
  const chips = getDestinationChips(destination, units);
  const showRawSegmentName = destination.customLabel && destination.customLabel !== destination.segmentName;
  const completionLabel = completed ? 'Completed destination' : 'Remaining destination';
  const CompletionStatusIcon = completed ? CheckCircleIcon : ClockIcon;

  return (
    <article className="leaderboard-card explorer-hub-destination-card" data-testid={`explorer-destination-card-${destination.id}`}>
      <div className="explorer-hub-destination-header">
        <div className="explorer-hub-destination-main">
          <p className="explorer-section-label">Destination</p>
          <h3 className="explorer-hub-destination-title">
            {destination.sourceUrl ? (
              <a
                className="explorer-hub-destination-link"
                href={destination.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="explorer-hub-destination-link-text">{destination.displayLabel}</span>
                <ArrowTopRightOnSquareIcon aria-hidden="true" />
              </a>
            ) : (
              destination.displayLabel
            )}
          </h3>
          {showRawSegmentName ? (
            <p className="explorer-hub-secondary-copy">Strava segment: {destination.segmentName}</p>
          ) : null}
        </div>

        <div className="explorer-hub-destination-actions">
          <div className="explorer-hub-status-icons" data-testid={`explorer-destination-status-icons-${destination.id}`}>
            {pinned && !showPinAction ? (
              <span
                className="explorer-hub-status-icon flagged"
                data-testid={`explorer-destination-pin-indicator-${destination.id}`}
                aria-label="Flagged destination"
                title="Flagged destination"
              >
                <FlagIcon aria-hidden="true" />
                <span className="explorer-hub-sr-only">Flagged destination</span>
              </span>
            ) : null}

            <span
              className={`explorer-hub-status-icon ${completed ? 'completed' : 'remaining'}`}
              data-testid={`explorer-destination-status-${destination.id}`}
              aria-label={completionLabel}
              title={completionLabel}
            >
              <CompletionStatusIcon aria-hidden="true" />
              <span className="explorer-hub-sr-only">{completionLabel}</span>
            </span>
          </div>

          {showPinAction ? (
            <button
              type="button"
              className={`explorer-hub-pin-button ${pinned ? 'active' : ''}`}
              data-testid={`explorer-pin-toggle-${destination.id}`}
              aria-label={pinned ? `Unpin ${destination.displayLabel}` : `Pin ${destination.displayLabel}`}
              aria-pressed={pinned}
              disabled={pinDisabled}
              onClick={() => {
                void onTogglePin?.(destination.id, pinned);
              }}
            >
              <BookmarkIcon aria-hidden="true" />
              <span className="explorer-hub-sr-only">{pinned ? 'Unpin destination' : 'Pin destination'}</span>
            </button>
          ) : null}
        </div>
      </div>

      {chips.length > 0 ? (
        <div className="explorer-hub-chip-row">
          {chips.map((chip) => (
            <span key={`${destination.id}-${chip}`} className="week-header-chip">{chip}</span>
          ))}
        </div>
      ) : null}

      {completed && matchedAt ? (
        <p className="explorer-hub-completion-copy">
          <CheckCircleIcon aria-hidden="true" />
          Completed on {formatUnixDate(matchedAt, { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      ) : (
        <p className="explorer-hub-secondary-copy">Ride this destination once during the campaign to check it off.</p>
      )}
    </article>
  );
}

function ExplorerHubPage({ isAdmin, isConnected }: ExplorerHubPageProps) {
  const browseSearchId = useId();
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<ExplorerTab>('hub');
  const [showAllRemaining, setShowAllRemaining] = useState(false);
  const [showAllCompleted, setShowAllCompleted] = useState(false);
  const [destinationSearchQuery, setDestinationSearchQuery] = useState('');
  const [destinationFilter, setDestinationFilter] = useState<DestinationFilter>('all');
  const [pendingPinDestinationId, setPendingPinDestinationId] = useState<number | null>(null);
  const deferredDestinationSearchQuery = useDeferredValue(destinationSearchQuery);

  const activeCampaignQuery = trpc.explorer.getActiveCampaign.useQuery(undefined, {
    enabled: isAdmin,
    refetchOnWindowFocus: false,
  });

  const activeCampaignId = activeCampaignQuery.data?.id;
  const progressQuery = trpc.explorer.getCampaignProgress.useQuery(
    { campaignId: activeCampaignId ?? 0 },
    {
      enabled: Boolean(isAdmin && isConnected && activeCampaignId),
      refetchOnWindowFocus: false,
    }
  );

  const activeCampaign = activeCampaignQuery.data;
  const progress = progressQuery.data;
  const pinDestinationMutation = trpc.explorer.pinDestination.useMutation();
  const unpinDestinationMutation = trpc.explorer.unpinDestination.useMutation();
  const activeCampaignDestinations = activeCampaign?.destinations ?? EMPTY_DESTINATIONS;
  const destinations: ExplorerProgressDestinationSummary[] = useMemo(
    () => progress?.destinations ?? activeCampaignDestinations.map((destination) => ({
      ...destination,
      completed: false,
      pinned: false,
      matchedAt: null,
      stravaActivityId: null,
    })),
    [activeCampaignDestinations, progress?.destinations]
  );
  const completedDestinations = progress?.completedDestinations ?? 0;
  const totalDestinations = progress?.totalDestinations ?? activeCampaignDestinations.length;
  const remainingDestinations = useMemo(
    () => destinations
      .filter((destination) => !destination.completed)
      .sort((left, right) => left.displayOrder - right.displayOrder || left.id - right.id),
    [destinations]
  );
  const pinnedRemainingDestinations = useMemo(
    () => remainingDestinations.filter((destination) => destination.pinned),
    [remainingDestinations]
  );
  const prioritizedRemainingDestinations = useMemo(
    () => [
      ...remainingDestinations.filter((destination) => destination.pinned),
      ...remainingDestinations.filter((destination) => !destination.pinned),
    ],
    [remainingDestinations]
  );
  const finishedDestinations = useMemo(
    () => destinations
      .filter((destination) => destination.completed)
      .sort((left, right) => (right.matchedAt ?? 0) - (left.matchedAt ?? 0) || left.displayOrder - right.displayOrder || left.id - right.id),
    [destinations]
  );
  const progressPercent = totalDestinations > 0 ? Math.round((completedDestinations / totalDestinations) * 100) : 0;
  const visibleRemainingDestinations = showAllRemaining
    ? prioritizedRemainingDestinations
    : prioritizedRemainingDestinations.slice(0, DEFAULT_REMAINING_VISIBLE);
  const visibleCompletedDestinations = showAllCompleted
    ? finishedDestinations
    : finishedDestinations.slice(0, DEFAULT_COMPLETED_VISIBLE);
  const destinationsByCampaignOrder = useMemo(
    () => [...destinations].sort((left, right) => left.displayOrder - right.displayOrder || left.id - right.id),
    [destinations]
  );
  const filteredDestinations = useMemo(
    () => destinationsByCampaignOrder.filter((destination) => {
      if (destinationFilter === 'remaining' && destination.completed) {
        return false;
      }

      if (destinationFilter === 'completed' && !destination.completed) {
        return false;
      }

      return matchesDestinationSearch(destination, deferredDestinationSearchQuery);
    }),
    [deferredDestinationSearchQuery, destinationFilter, destinationsByCampaignOrder]
  );
  const isBrowseFiltered = destinationFilter !== 'all' || deferredDestinationSearchQuery.trim().length > 0;
  const destinationResultsLabel = isBrowseFiltered
    ? `${filteredDestinations.length} of ${destinationsByCampaignOrder.length}`
    : `${destinationsByCampaignOrder.length}`;

  async function handleTogglePin(destinationId: number, pinned: boolean) {
    if (!activeCampaignId) {
      return;
    }

    setPendingPinDestinationId(destinationId);

    try {
      if (pinned) {
        await unpinDestinationMutation.mutateAsync({ campaignId: activeCampaignId, destinationId });
      } else {
        await pinDestinationMutation.mutateAsync({ campaignId: activeCampaignId, destinationId });
      }

      await utils.explorer.getCampaignProgress.invalidate({ campaignId: activeCampaignId });
    } finally {
      setPendingPinDestinationId(null);
    }
  }

  if (!isAdmin) {
    return (
      <div className="explorer-hub-page" data-testid="explorer-hub-page">
        <div className="explorer-hub-access-denied" data-testid="explorer-hub-access-denied">
          <h2>Access Denied</h2>
          <p>You do not have admin permissions to preview the Explorer hub yet.</p>
        </div>
      </div>
    );
  }

  if (activeCampaignQuery.isLoading) {
    return (
      <div className="explorer-hub-page" data-testid="explorer-hub-page">
        <section className="leaderboard-card explorer-hub-hero">
          <p className="explorer-section-label">Explorer preview</p>
          <h2>Loading Explorer</h2>
          <p className="explorer-hub-secondary-copy">Preparing the active campaign view.</p>
        </section>
      </div>
    );
  }

  if (activeCampaignQuery.error) {
    return (
      <div className="explorer-hub-page" data-testid="explorer-hub-page">
        <section className="explorer-hub-empty-state" data-testid="explorer-hub-error-state">
          <h2>Explorer unavailable</h2>
          <p>{activeCampaignQuery.error.message}</p>
        </section>
      </div>
    );
  }

  if (!activeCampaign) {
    return (
      <div className="explorer-hub-page" data-testid="explorer-hub-page">
        <section className="leaderboard-card explorer-hub-hero">
          <p className="explorer-section-label">Explorer preview</p>
          <h2>Explorer hub</h2>
          <p className="explorer-hub-secondary-copy">
            This route is the future athlete-facing Explorer page. It stays admin-gated until the feature is ready for wider release.
          </p>
        </section>

        <section className="explorer-hub-empty-state" data-testid="explorer-hub-empty-state">
          <h3>No active campaign yet</h3>
          <p>Create an Explorer campaign and add at least one destination before previewing the athlete page.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="explorer-hub-page" data-testid="explorer-hub-page">
      <section className="leaderboard-card explorer-hub-hero" data-testid="explorer-hub-hero">
        <div className="explorer-hub-hero-topline">
          <div>
            <p className="explorer-section-label">Explorer preview</p>
            <h2>{activeCampaign.name}</h2>
          </div>
          <span className="explorer-hub-preview-pill">Admin-gated preview</span>
        </div>

        <div className="explorer-hub-chip-row">
          <span className="week-header-chip">
            <CalendarDaysIcon className="week-header-chip-icon" />
            {formatUnixDate(activeCampaign.startAt, { month: 'short', day: 'numeric' })} - {formatUnixDate(activeCampaign.endAt, { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <span className="week-header-chip">
            <FlagIcon className="week-header-chip-icon" />
            {totalDestinations} destinations
          </span>
          <span className="week-header-chip">
            <CheckBadgeIcon className="week-header-chip-icon" />
            {completedDestinations} completed
          </span>
        </div>

        <p className="explorer-hub-secondary-copy">
          {activeCampaign.rulesBlurb || 'Ride each destination once during the campaign window to complete the set.'}
        </p>
      </section>

      {!isConnected ? (
        <section className="explorer-hub-empty-state" data-testid="explorer-hub-connect-state">
          <h3>Connect Strava to see personal progress</h3>
          <p>The active campaign is visible, but checklist completion only appears for connected athletes.</p>
        </section>
      ) : null}

      {activeTab === 'hub' ? (
        <>
          <section className="leaderboard-card explorer-hub-progress-card" data-testid="explorer-progress-card">
            <div className="explorer-hub-progress-header">
              <div>
                <p className="explorer-section-label">Your progress</p>
                <h3>
                  {completedDestinations} of {totalDestinations} destinations complete
                </h3>
              </div>
              <p className="explorer-hub-progress-percent" data-testid="explorer-progress-percent">{progressPercent}%</p>
            </div>

            <div className="explorer-hub-progress-bar" aria-hidden="true">
              <div className="explorer-hub-progress-bar-fill" style={{ width: `${progressPercent}%` }} />
            </div>

            <div className="explorer-hub-progress-grid">
              <div>
                <span className="explorer-hub-progress-label">Remaining</span>
                <strong>{remainingDestinations.length}</strong>
              </div>
              <div>
                <span className="explorer-hub-progress-label">Completed</span>
                <strong>{finishedDestinations.length}</strong>
              </div>
              <div>
                <span className="explorer-hub-progress-label">Campaign status</span>
                <strong>{finishedDestinations.length === totalDestinations && totalDestinations > 0 ? 'Complete' : 'In progress'}</strong>
              </div>
            </div>
          </section>

          <div className="explorer-hub-section-grid">
            <section className="explorer-hub-section" data-testid="explorer-remaining-section">
              <div className="explorer-hub-section-header">
                <div>
                  <p className="explorer-section-label">Next up</p>
                  <h3>Remaining destinations</h3>
                  <p className="explorer-hub-section-note" data-testid="explorer-remaining-note">
                    {pinnedRemainingDestinations.length > 0
                      ? 'Pinned destinations surface first, then the rest stay in campaign order.'
                      : 'Use the Destinations tab to pin what you want to ride next.'}
                  </p>
                </div>
                <span className="explorer-hub-section-count">{remainingDestinations.length}</span>
              </div>

              {remainingDestinations.length === 0 ? (
                <div className="explorer-hub-empty-state compact" data-testid="explorer-remaining-empty-state">
                  <h4>All destinations completed</h4>
                  <p>This athlete has checked off every destination in the active campaign.</p>
                </div>
              ) : pinnedRemainingDestinations.length === 0 ? (
                <>
                  <div className="explorer-hub-empty-state compact" data-testid="explorer-pinned-empty-state">
                    <h4>No pinned destinations yet</h4>
                    <p>Switch to Destinations to pin places you want to visit next.</p>
                  </div>

                  <div className="explorer-hub-destination-list">
                    {visibleRemainingDestinations.map((destination) => (
                      <ExplorerDestinationCard
                        key={destination.id}
                        destination={destination}
                        completed={false}
                        pinned={destination.pinned}
                        matchedAt={null}
                      />
                    ))}

                    {remainingDestinations.length > DEFAULT_REMAINING_VISIBLE ? (
                      <button
                        type="button"
                        className="explorer-hub-show-more"
                        data-testid="explorer-remaining-toggle"
                        onClick={() => setShowAllRemaining((current) => !current)}
                      >
                        {showAllRemaining
                          ? 'Show fewer remaining destinations'
                          : `Show all ${remainingDestinations.length} remaining destinations`}
                      </button>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="explorer-hub-destination-list">
                  {visibleRemainingDestinations.map((destination) => (
                    <ExplorerDestinationCard
                      key={destination.id}
                      destination={destination}
                      completed={false}
                      pinned={destination.pinned}
                      matchedAt={null}
                    />
                  ))}

                  {remainingDestinations.length > DEFAULT_REMAINING_VISIBLE ? (
                    <button
                      type="button"
                      className="explorer-hub-show-more"
                      data-testid="explorer-remaining-toggle"
                      onClick={() => setShowAllRemaining((current) => !current)}
                    >
                      {showAllRemaining
                        ? 'Show fewer remaining destinations'
                        : `Show all ${remainingDestinations.length} remaining destinations`}
                    </button>
                  ) : null}
                </div>
              )}
            </section>

            <section className="explorer-hub-section" data-testid="explorer-completed-section">
              <div className="explorer-hub-section-header">
                <div>
                  <p className="explorer-section-label">Progress log</p>
                  <h3>Completed destinations</h3>
                  <p className="explorer-hub-section-note">Newest completions first.</p>
                </div>
                <span className="explorer-hub-section-count">{finishedDestinations.length}</span>
              </div>

              {progressQuery.isLoading && isConnected ? (
                <div className="explorer-hub-empty-state compact" data-testid="explorer-progress-loading-state">
                  <h4>Loading progress</h4>
                  <p>Pulling the athlete's current Explorer matches.</p>
                </div>
              ) : finishedDestinations.length === 0 ? (
                <div className="explorer-hub-empty-state compact" data-testid="explorer-completed-empty-state">
                  <h4>No destinations completed yet</h4>
                  <p>Completed destinations will appear here as the athlete checks them off.</p>
                </div>
              ) : (
                <div className="explorer-hub-destination-list">
                  {visibleCompletedDestinations.map((destination) => (
                    <ExplorerDestinationCard
                      key={destination.id}
                      destination={destination}
                      completed
                      pinned={destination.pinned}
                      matchedAt={destination.matchedAt}
                    />
                  ))}

                  {finishedDestinations.length > DEFAULT_COMPLETED_VISIBLE ? (
                    <button
                      type="button"
                      className="explorer-hub-show-more"
                      data-testid="explorer-completed-toggle"
                      onClick={() => setShowAllCompleted((current) => !current)}
                    >
                      {showAllCompleted
                        ? 'Show fewer completed destinations'
                        : `Show all ${finishedDestinations.length} completed destinations`}
                    </button>
                  ) : null}
                </div>
              )}
            </section>
          </div>

          <section className="leaderboard-card explorer-hub-follow-on-card" data-testid="explorer-follow-on-card">
            <div className="explorer-hub-follow-on-header">
              <div>
                <p className="explorer-section-label">Later phases</p>
                <h3>Map and social work stay deferred</h3>
              </div>
              <MapPinIcon aria-hidden="true" />
            </div>
            <p className="explorer-hub-secondary-copy">
              This first athlete page stays list-first on purpose. Map discovery and broader social visibility can layer onto this route later without turning the initial release into an overloaded surface.
            </p>
          </section>
        </>
      ) : (
        <section className="explorer-hub-destinations-view" data-testid="explorer-destinations-view">
          <section className="leaderboard-card explorer-hub-search-card" data-testid="explorer-search-card">
            <div className="explorer-hub-section-header">
              <div>
                <p className="explorer-section-label">Browse controls</p>
                <h3>Search and filters</h3>
              </div>
            </div>
            <p className="explorer-hub-secondary-copy">
              Filter the current campaign list by destination name, segment name, location, or completion status.
            </p>
            <div className="explorer-search-stub" data-testid="explorer-search-stub">
              <div className="explorer-search-stub-input">
                <MagnifyingGlassIcon aria-hidden="true" />
                <label className="explorer-hub-sr-only" htmlFor={browseSearchId}>Search destinations</label>
                <input
                  id={browseSearchId}
                  type="text"
                  data-testid="explorer-search-input"
                  placeholder="Search by destination name, segment, or location"
                  value={destinationSearchQuery}
                  onChange={(event) => setDestinationSearchQuery(event.target.value)}
                />
              </div>
            </div>
            <div className="explorer-hub-filter-row" data-testid="explorer-filter-row">
              <button
                type="button"
                className={`week-header-chip explorer-hub-filter-chip ${destinationFilter === 'all' ? 'active' : ''}`}
                data-testid="explorer-filter-all"
                aria-pressed={destinationFilter === 'all'}
                onClick={() => setDestinationFilter('all')}
              >
                All
              </button>
              <button
                type="button"
                className={`week-header-chip explorer-hub-filter-chip ${destinationFilter === 'remaining' ? 'active' : ''}`}
                data-testid="explorer-filter-remaining"
                aria-pressed={destinationFilter === 'remaining'}
                onClick={() => setDestinationFilter('remaining')}
              >
                Remaining
              </button>
              <button
                type="button"
                className={`week-header-chip explorer-hub-filter-chip ${destinationFilter === 'completed' ? 'active' : ''}`}
                data-testid="explorer-filter-completed"
                aria-pressed={destinationFilter === 'completed'}
                onClick={() => setDestinationFilter('completed')}
              >
                Completed
              </button>
            </div>
          </section>

          <section className="explorer-hub-section" data-testid="explorer-all-destinations-section">
            <div className="explorer-hub-section-header">
              <div>
                <p className="explorer-section-label">Campaign list</p>
                <h3>All destinations</h3>
                <p className="explorer-hub-section-note" data-testid="explorer-results-note">
                  {isBrowseFiltered
                    ? `Showing ${filteredDestinations.length} matching destinations in campaign order.`
                    : 'Full campaign order with completion state.'}
                </p>
              </div>
              <span className="explorer-hub-section-count" data-testid="explorer-results-count">{destinationResultsLabel}</span>
            </div>

            {filteredDestinations.length === 0 ? (
              <div className="explorer-hub-empty-state compact" data-testid="explorer-filtered-empty-state">
                <h4>No destinations match this view</h4>
                <p>Try a different search or switch the completion filter to see more destinations.</p>
              </div>
            ) : (
              <div className="explorer-hub-destination-list">
                {filteredDestinations.map((destination) => (
                  <ExplorerDestinationCard
                    key={destination.id}
                    destination={destination}
                    completed={destination.completed}
                    pinned={destination.pinned}
                    matchedAt={destination.matchedAt}
                    showPinAction={isConnected}
                    pinDisabled={pendingPinDestinationId === destination.id}
                    onTogglePin={handleTogglePin}
                  />
                ))}
              </div>
            )}
          </section>
        </section>
      )}

      <div className="bottom-nav-spacer" data-testid="explorer-bottom-nav-spacer" />
      <ExplorerBottomNav activeTab={activeTab} onSelect={setActiveTab} />
    </div>
  );
}

export default ExplorerHubPage;