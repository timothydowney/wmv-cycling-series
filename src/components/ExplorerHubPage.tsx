import { useState } from 'react';
import {
  ArrowTopRightOnSquareIcon,
  CalendarDaysIcon,
  CheckBadgeIcon,
  CheckCircleIcon,
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
  matchedAt: number | null;
  stravaActivityId: string | null;
}

type ExplorerTab = 'hub' | 'destinations';

const DEFAULT_REMAINING_VISIBLE = 10;
const DEFAULT_COMPLETED_VISIBLE = 10;

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

function ExplorerDestinationCard({
  destination,
  completed,
  matchedAt,
}: {
  destination: ExplorerDestinationSummary;
  completed: boolean;
  matchedAt: number | null;
}) {
  const { units } = useUnits();
  const chips = getDestinationChips(destination, units);
  const showRawSegmentName = destination.customLabel && destination.customLabel !== destination.segmentName;

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

        <span
          className={`explorer-hub-status-pill ${completed ? 'completed' : 'remaining'}`}
          data-testid={`explorer-destination-status-${destination.id}`}
        >
          {completed ? 'Completed' : 'Remaining'}
        </span>
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
  const [activeTab, setActiveTab] = useState<ExplorerTab>('hub');
  const [showAllRemaining, setShowAllRemaining] = useState(false);
  const [showAllCompleted, setShowAllCompleted] = useState(false);

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

  const activeCampaign = activeCampaignQuery.data;

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

  const progress = progressQuery.data;
  const destinations: ExplorerProgressDestinationSummary[] = progress?.destinations ?? activeCampaign.destinations.map((destination) => ({
    ...destination,
    completed: false,
    matchedAt: null,
    stravaActivityId: null,
  }));
  const completedDestinations = progress?.completedDestinations ?? 0;
  const totalDestinations = progress?.totalDestinations ?? activeCampaign.destinations.length;
  const remainingDestinations = destinations
    .filter((destination) => !destination.completed)
    .sort((left, right) => left.displayOrder - right.displayOrder || left.id - right.id);
  const finishedDestinations = destinations
    .filter((destination) => destination.completed)
    .sort((left, right) => (right.matchedAt ?? 0) - (left.matchedAt ?? 0) || left.displayOrder - right.displayOrder || left.id - right.id);
  const progressPercent = totalDestinations > 0 ? Math.round((completedDestinations / totalDestinations) * 100) : 0;
  const visibleRemainingDestinations = showAllRemaining
    ? remainingDestinations
    : remainingDestinations.slice(0, DEFAULT_REMAINING_VISIBLE);
  const visibleCompletedDestinations = showAllCompleted
    ? finishedDestinations
    : finishedDestinations.slice(0, DEFAULT_COMPLETED_VISIBLE);
  const destinationsByCampaignOrder = [...destinations]
    .sort((left, right) => left.displayOrder - right.displayOrder || left.id - right.id);

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
                  <p className="explorer-hub-section-note">Showing campaign order for now.</p>
                </div>
                <span className="explorer-hub-section-count">{remainingDestinations.length}</span>
              </div>

              {remainingDestinations.length === 0 ? (
                <div className="explorer-hub-empty-state compact" data-testid="explorer-remaining-empty-state">
                  <h4>All destinations completed</h4>
                  <p>This athlete has checked off every destination in the active campaign.</p>
                </div>
              ) : (
                <div className="explorer-hub-destination-list">
                  {visibleRemainingDestinations.map((destination) => (
                    <ExplorerDestinationCard
                      key={destination.id}
                      destination={destination}
                      completed={false}
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
                <p className="explorer-section-label">Browse stub</p>
                <h3>Search and filters</h3>
              </div>
            </div>
            <p className="explorer-hub-secondary-copy">
              This stays disabled for 5A, but it reserves the shape for later browse and location-aware discovery work.
            </p>
            <div className="explorer-search-stub" data-testid="explorer-search-stub">
              <div className="explorer-search-stub-input">
                <MagnifyingGlassIcon aria-hidden="true" />
                <input
                  type="text"
                  placeholder="Search by destination name or location coming soon"
                  disabled
                />
              </div>
            </div>
          </section>

          <section className="explorer-hub-section" data-testid="explorer-all-destinations-section">
            <div className="explorer-hub-section-header">
              <div>
                <p className="explorer-section-label">Campaign list</p>
                <h3>All destinations</h3>
                <p className="explorer-hub-section-note">Full campaign order with completion state.</p>
              </div>
              <span className="explorer-hub-section-count">{destinationsByCampaignOrder.length}</span>
            </div>

            <div className="explorer-hub-destination-list">
              {destinationsByCampaignOrder.map((destination) => (
                <ExplorerDestinationCard
                  key={destination.id}
                  destination={destination}
                  completed={destination.completed}
                  matchedAt={destination.matchedAt}
                />
              ))}
            </div>
          </section>
        </section>
      )}

      <div className="bottom-nav-spacer" data-testid="explorer-bottom-nav-spacer" />
      <ExplorerBottomNav activeTab={activeTab} onSelect={setActiveTab} />
    </div>
  );
}

export default ExplorerHubPage;