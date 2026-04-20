import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ExplorerHubPage from '../ExplorerHubPage';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const unitMocks = vi.hoisted(() => ({
  units: 'imperial' as 'imperial' | 'metric',
  setUnits: vi.fn(),
}));

const trpcMocks = vi.hoisted(() => ({
  activeCampaignUseQuery: vi.fn(),
  progressUseQuery: vi.fn(),
  activeCampaignQuery: {
    data: null as null | {
      id: number;
      name: string;
      startAt: number;
      endAt: number;
      rulesBlurb: string | null;
      destinations: Array<{
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
      }>;
    },
    isLoading: false,
    error: null as Error | null,
  },
  progressQuery: {
    data: null as null | {
      campaign: {
        id: number;
        name: string;
        startAt: number;
        endAt: number;
        rulesBlurb: string | null;
      };
      completedDestinations: number;
      totalDestinations: number;
      destinations: Array<{
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
        completed: boolean;
        matchedAt: number | null;
        stravaActivityId: string | null;
      }>;
    },
    isLoading: false,
  },
}));

vi.mock('../../utils/trpc', () => ({
  trpc: {
    explorer: {
      getActiveCampaign: {
        useQuery: (...args: unknown[]) => {
          trpcMocks.activeCampaignUseQuery(...args);
          return trpcMocks.activeCampaignQuery;
        },
      },
      getCampaignProgress: {
        useQuery: (...args: unknown[]) => {
          trpcMocks.progressUseQuery(...args);
          return trpcMocks.progressQuery;
        },
      },
    },
  },
}));

vi.mock('../../context/UnitContext', () => ({
  useUnits: () => unitMocks,
}));

interface RenderResult {
  container: HTMLDivElement;
  root: Root;
}

let renderResult: RenderResult | null = null;

async function renderPage(overrides: Partial<ComponentProps<typeof ExplorerHubPage>> = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<ExplorerHubPage isAdmin isConnected {...overrides} />);
  });

  renderResult = { container, root };
  return renderResult;
}

async function clickElement(element: Element | null) {
  if (!(element instanceof HTMLElement)) {
    throw new Error('Expected clickable HTMLElement');
  }

  await act(async () => {
    element.click();
  });
}

describe('ExplorerHubPage', () => {
  beforeEach(() => {
    trpcMocks.activeCampaignUseQuery.mockReset();
    trpcMocks.progressUseQuery.mockReset();
    trpcMocks.activeCampaignQuery.data = null;
    trpcMocks.activeCampaignQuery.error = null;
    trpcMocks.activeCampaignQuery.isLoading = false;
    trpcMocks.progressQuery.data = null;
    trpcMocks.progressQuery.isLoading = false;
    unitMocks.units = 'imperial';
  });

  afterEach(async () => {
    if (renderResult) {
      const currentRenderResult = renderResult;
      await act(async () => {
        currentRenderResult.root.unmount();
      });
      currentRenderResult.container.remove();
      renderResult = null;
    }
  });

  it('shows an access denied state for non-admin users', async () => {
    const { container } = await renderPage({ isAdmin: false });

    expect(container.querySelector('[data-testid="explorer-hub-access-denied"]')?.textContent).toContain('Access Denied');
    expect(trpcMocks.activeCampaignUseQuery).toHaveBeenCalledWith(undefined, expect.objectContaining({ enabled: false }));
    expect(trpcMocks.progressUseQuery).toHaveBeenCalledWith({ campaignId: 0 }, expect.objectContaining({ enabled: false }));
  });

  it('shows an empty state when there is no active campaign', async () => {
    const { container } = await renderPage();

    expect(container.querySelector('[data-testid="explorer-hub-empty-state"]')?.textContent).toContain('No active campaign yet');
  });

  it('renders the active campaign with remaining and completed destinations', async () => {
    trpcMocks.activeCampaignQuery.data = {
      id: 44,
      name: 'Hilltown Explorer',
      startAt: 1751328000,
      endAt: 1753919999,
      rulesBlurb: 'Ride each destination once.',
      destinations: [
        {
          id: 501,
          stravaSegmentId: 'seg-501',
          displayOrder: 1,
          displayLabel: 'North Road Climb',
          customLabel: null,
          segmentName: 'North Road Climb',
          sourceUrl: 'https://www.strava.com/segments/501',
          distance: 3200,
          averageGrade: 4.8,
          city: 'Shelburne Falls',
          state: 'MA',
          country: 'USA',
        },
        {
          id: 502,
          stravaSegmentId: 'seg-502',
          displayOrder: 2,
          displayLabel: 'River Valley Spin',
          customLabel: 'River Valley Spin',
          segmentName: 'River Valley Segment',
          sourceUrl: 'https://www.strava.com/segments/502',
          distance: 5400,
          averageGrade: 1.9,
          city: 'Greenfield',
          state: 'MA',
          country: 'USA',
        },
      ],
    };

    trpcMocks.progressQuery.data = {
      campaign: {
        id: 44,
        name: 'Hilltown Explorer',
        startAt: 1751328000,
        endAt: 1753919999,
        rulesBlurb: 'Ride each destination once.',
      },
      completedDestinations: 1,
      totalDestinations: 2,
      destinations: [
        {
          id: 501,
          stravaSegmentId: 'seg-501',
          displayOrder: 1,
          displayLabel: 'North Road Climb',
          customLabel: null,
          segmentName: 'North Road Climb',
          sourceUrl: 'https://www.strava.com/segments/501',
          distance: 3200,
          averageGrade: 4.8,
          city: 'Shelburne Falls',
          state: 'MA',
          country: 'USA',
          completed: false,
          matchedAt: null,
          stravaActivityId: null,
        },
        {
          id: 502,
          stravaSegmentId: 'seg-502',
          displayOrder: 2,
          displayLabel: 'River Valley Spin',
          customLabel: 'River Valley Spin',
          segmentName: 'River Valley Segment',
          sourceUrl: 'https://www.strava.com/segments/502',
          distance: 5400,
          averageGrade: 1.9,
          city: 'Greenfield',
          state: 'MA',
          country: 'USA',
          completed: true,
          matchedAt: 1751673600,
          stravaActivityId: 'activity-502',
        },
      ],
    };

    const { container } = await renderPage();

    expect(container.querySelector('[data-testid="explorer-bottom-nav"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="explorer-tab-hub"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('[data-testid="explorer-hub-hero"]')?.textContent).toContain('Hilltown Explorer');
    expect(container.querySelector('[data-testid="explorer-progress-percent"]')?.textContent).toContain('50%');
    expect(container.querySelector('[data-testid="explorer-remaining-section"]')?.textContent).toContain('North Road Climb');
    expect(container.querySelector('[data-testid="explorer-completed-section"]')?.textContent).toContain('River Valley Spin');
    expect(container.querySelector('[data-testid="explorer-destination-status-501"]')?.textContent).toContain('Remaining');
    expect(container.querySelector('[data-testid="explorer-destination-status-502"]')?.textContent).toContain('Completed');
    expect(container.querySelector('[data-testid="explorer-search-card"]')).toBeNull();
  });

  it('shows Hub summary lists with a 10-item default cap', async () => {
    trpcMocks.activeCampaignQuery.data = {
      id: 88,
      name: 'Long List Explorer',
      startAt: 1751328000,
      endAt: 1753919999,
      rulesBlurb: null,
      destinations: [],
    };

    trpcMocks.progressQuery.data = {
      campaign: {
        id: 88,
        name: 'Long List Explorer',
        startAt: 1751328000,
        endAt: 1753919999,
        rulesBlurb: null,
      },
      completedDestinations: 4,
      totalDestinations: 9,
      destinations: [
        {
          id: 1,
          stravaSegmentId: 'seg-1',
          displayOrder: 1,
          displayLabel: 'Remaining 1',
          customLabel: null,
          segmentName: 'Remaining 1',
          sourceUrl: null,
          distance: null,
          averageGrade: null,
          city: null,
          state: null,
          country: null,
          completed: false,
          matchedAt: null,
          stravaActivityId: null,
        },
        {
          id: 2,
          stravaSegmentId: 'seg-2',
          displayOrder: 2,
          displayLabel: 'Remaining 2',
          customLabel: null,
          segmentName: 'Remaining 2',
          sourceUrl: null,
          distance: null,
          averageGrade: null,
          city: null,
          state: null,
          country: null,
          completed: false,
          matchedAt: null,
          stravaActivityId: null,
        },
        {
          id: 3,
          stravaSegmentId: 'seg-3',
          displayOrder: 3,
          displayLabel: 'Remaining 3',
          customLabel: null,
          segmentName: 'Remaining 3',
          sourceUrl: null,
          distance: null,
          averageGrade: null,
          city: null,
          state: null,
          country: null,
          completed: false,
          matchedAt: null,
          stravaActivityId: null,
        },
        {
          id: 4,
          stravaSegmentId: 'seg-4',
          displayOrder: 4,
          displayLabel: 'Remaining 4',
          customLabel: null,
          segmentName: 'Remaining 4',
          sourceUrl: null,
          distance: null,
          averageGrade: null,
          city: null,
          state: null,
          country: null,
          completed: false,
          matchedAt: null,
          stravaActivityId: null,
        },
        {
          id: 5,
          stravaSegmentId: 'seg-5',
          displayOrder: 5,
          displayLabel: 'Remaining 5',
          customLabel: null,
          segmentName: 'Remaining 5',
          sourceUrl: null,
          distance: null,
          averageGrade: null,
          city: null,
          state: null,
          country: null,
          completed: false,
          matchedAt: null,
          stravaActivityId: null,
        },
        {
          id: 6,
          stravaSegmentId: 'seg-6',
          displayOrder: 6,
          displayLabel: 'Completed Older',
          customLabel: null,
          segmentName: 'Completed Older',
          sourceUrl: null,
          distance: null,
          averageGrade: null,
          city: null,
          state: null,
          country: null,
          completed: true,
          matchedAt: 1751500000,
          stravaActivityId: 'act-6',
        },
        {
          id: 7,
          stravaSegmentId: 'seg-7',
          displayOrder: 7,
          displayLabel: 'Completed Newest',
          customLabel: null,
          segmentName: 'Completed Newest',
          sourceUrl: null,
          distance: null,
          averageGrade: null,
          city: null,
          state: null,
          country: null,
          completed: true,
          matchedAt: 1751800000,
          stravaActivityId: 'act-7',
        },
        {
          id: 8,
          stravaSegmentId: 'seg-8',
          displayOrder: 8,
          displayLabel: 'Completed Middle',
          customLabel: null,
          segmentName: 'Completed Middle',
          sourceUrl: null,
          distance: null,
          averageGrade: null,
          city: null,
          state: null,
          country: null,
          completed: true,
          matchedAt: 1751600000,
          stravaActivityId: 'act-8',
        },
        {
          id: 9,
          stravaSegmentId: 'seg-9',
          displayOrder: 9,
          displayLabel: 'Completed Hidden',
          customLabel: null,
          segmentName: 'Completed Hidden',
          sourceUrl: null,
          distance: null,
          averageGrade: null,
          city: null,
          state: null,
          country: null,
          completed: true,
          matchedAt: 1751400000,
          stravaActivityId: 'act-9',
        },
      ],
    };

    const { container } = await renderPage();

    const remainingSection = container.querySelector('[data-testid="explorer-remaining-section"]');
    expect(remainingSection?.textContent).toContain('Remaining 5');
    expect(remainingSection?.textContent).not.toContain('Show all');

    const completedSection = container.querySelector('[data-testid="explorer-completed-section"]');
    expect(completedSection?.textContent).toContain('Completed Newest');
    expect(completedSection?.textContent).toContain('Completed Middle');
    expect(completedSection?.textContent).toContain('Completed Older');
    expect(completedSection?.textContent).toContain('Completed Hidden');
    expect(completedSection?.textContent).not.toContain('Show all');
  });

  it('shows the disabled search stub and full list in Destinations', async () => {
    trpcMocks.activeCampaignQuery.data = {
      id: 99,
      name: 'Destination Browser',
      startAt: 1751328000,
      endAt: 1753919999,
      rulesBlurb: null,
      destinations: [
        {
          id: 900,
          stravaSegmentId: 'seg-900',
          displayOrder: 1,
          displayLabel: 'Alpha Climb',
          customLabel: null,
          segmentName: 'Alpha Climb',
          sourceUrl: null,
          distance: null,
          averageGrade: null,
          city: null,
          state: null,
          country: null,
        },
        {
          id: 901,
          stravaSegmentId: 'seg-901',
          displayOrder: 2,
          displayLabel: 'Beta Rollers',
          customLabel: null,
          segmentName: 'Beta Rollers',
          sourceUrl: null,
          distance: null,
          averageGrade: null,
          city: null,
          state: null,
          country: null,
        },
      ],
    };

    trpcMocks.progressQuery.data = {
      campaign: {
        id: 99,
        name: 'Destination Browser',
        startAt: 1751328000,
        endAt: 1753919999,
        rulesBlurb: null,
      },
      completedDestinations: 1,
      totalDestinations: 2,
      destinations: [
        {
          id: 900,
          stravaSegmentId: 'seg-900',
          displayOrder: 1,
          displayLabel: 'Alpha Climb',
          customLabel: null,
          segmentName: 'Alpha Climb',
          sourceUrl: null,
          distance: null,
          averageGrade: null,
          city: null,
          state: null,
          country: null,
          completed: false,
          matchedAt: null,
          stravaActivityId: null,
        },
        {
          id: 901,
          stravaSegmentId: 'seg-901',
          displayOrder: 2,
          displayLabel: 'Beta Rollers',
          customLabel: null,
          segmentName: 'Beta Rollers',
          sourceUrl: null,
          distance: null,
          averageGrade: null,
          city: null,
          state: null,
          country: null,
          completed: true,
          matchedAt: 1751400000,
          stravaActivityId: 'act-901',
        },
      ],
    };

    const { container } = await renderPage();

    await clickElement(container.querySelector('[data-testid="explorer-tab-destinations"]'));

    expect(container.querySelector('[data-testid="explorer-tab-destinations"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('[data-testid="explorer-tab-map"]')?.getAttribute('aria-disabled')).toBe('true');
    expect(container.querySelector('[data-testid="explorer-destinations-view"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="explorer-search-card"]')).not.toBeNull();

    const searchInput = container.querySelector('[data-testid="explorer-search-stub"] input');
    expect(searchInput).not.toBeNull();
    expect((searchInput as HTMLInputElement).disabled).toBe(true);

    const allDestinations = container.querySelector('[data-testid="explorer-all-destinations-section"]');
    expect(allDestinations?.textContent).toContain('Alpha Climb');
    expect(allDestinations?.textContent).toContain('Beta Rollers');
    expect(allDestinations?.textContent).toContain('Remaining');
    expect(allDestinations?.textContent).toContain('Completed');
  });

  it('shows a connect prompt when the athlete is not connected', async () => {
    trpcMocks.activeCampaignQuery.data = {
      id: 77,
      name: 'Explorer Preview',
      startAt: 1751328000,
      endAt: 1753919999,
      rulesBlurb: null,
      destinations: [
        {
          id: 601,
          stravaSegmentId: 'seg-601',
          displayOrder: 1,
          displayLabel: 'Town Hill',
          customLabel: null,
          segmentName: 'Town Hill',
          sourceUrl: null,
          distance: null,
          averageGrade: null,
          city: null,
          state: null,
          country: null,
        },
      ],
    };

    const { container } = await renderPage({ isConnected: false });

    expect(container.querySelector('[data-testid="explorer-hub-connect-state"]')?.textContent).toContain('Connect Strava');
  });
});