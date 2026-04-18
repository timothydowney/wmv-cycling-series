import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Season } from '../../types';
import ExplorerAdminPanel from '../ExplorerAdminPanel';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const trpcMocks = vi.hoisted(() => ({
  campaignQuery: {
    data: null as null | {
      id: number;
      name: string;
      rulesBlurb: string | null;
      destinations: Array<{
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
      }>;
    },
    error: null as Error | null,
    isLoading: false,
  },
  invalidate: vi.fn(async () => undefined),
  validateSegment: vi.fn(async () => ({
    strava_segment_id: '2234642',
    name: 'Box Hill KOM',
    distance: 2931,
    average_grade: 5.4,
    city: 'Dorking',
    state: 'Surrey',
    country: 'United Kingdom',
  })),
  createCampaign: vi.fn(async (_input?: unknown) => ({ id: 1 })),
  addDestination: vi.fn(async (_input?: unknown) => ({
    id: 1,
    cached_name: 'Segment 1',
    strava_segment_id: '1',
    usedPlaceholderMetadata: true,
  })),
}));

vi.mock('../../utils/trpc', () => ({
  trpc: {
    useUtils: () => ({
      client: {
        segment: {
          validate: {
            query: trpcMocks.validateSegment,
          },
        },
      },
      explorerAdmin: {
        getCampaignForSeason: {
          invalidate: trpcMocks.invalidate,
        },
      },
    }),
    explorerAdmin: {
      getCampaignForSeason: {
        useQuery: () => trpcMocks.campaignQuery,
      },
      createCampaign: {
        useMutation: (options: {
          onError?: (error: Error) => void;
          onSuccess?: (result: unknown) => Promise<void> | void;
        }) => ({
          isPending: false,
          mutateAsync: async (input: unknown) => {
            try {
              const result = await trpcMocks.createCampaign(input);
              await options.onSuccess?.(result);
              return result;
            } catch (error) {
              options.onError?.(error as Error);
              throw error;
            }
          },
        }),
      },
      addDestination: {
        useMutation: (options: {
          onError?: (error: Error) => void;
          onSuccess?: (result: {
            cached_name: string;
            strava_segment_id: string;
            usedPlaceholderMetadata: boolean;
          }) => Promise<void> | void;
        }) => ({
          isPending: false,
          mutateAsync: async (input: unknown) => {
            try {
              const result = await trpcMocks.addDestination(input);
              await options.onSuccess?.(result);
              return result;
            } catch (error) {
              options.onError?.(error as Error);
              throw error;
            }
          },
        }),
      },
    },
  },
}));

const seasons: Season[] = [
  {
    id: 7,
    name: 'Spring 2026',
    start_at: 1711929600,
    end_at: 1714521600,
  },
  {
    id: 8,
    name: 'Summer 2026',
    start_at: 1717200000,
    end_at: 1719792000,
  },
];

interface RenderResult {
  container: HTMLDivElement;
  root: Root;
}

interface DeferredValue<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

let renderResult: RenderResult | null = null;

function createDeferredValue<T>(): DeferredValue<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

async function renderPanel(overrides: Partial<React.ComponentProps<typeof ExplorerAdminPanel>> = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <ExplorerAdminPanel
        isAdmin
        seasons={seasons}
        selectedSeasonId={seasons[0].id}
        onSeasonChange={vi.fn()}
        {...overrides}
      />
    );
  });

  renderResult = { container, root };
  return renderResult;
}

function getByTestId(container: HTMLElement, testId: string): HTMLElement {
  const element = container.querySelector(`[data-testid="${testId}"]`);

  if (!element) {
    throw new Error(`Expected element with data-testid="${testId}"`);
  }

  return element as HTMLElement;
}

function queryByTestId(container: HTMLElement, testId: string): HTMLElement | null {
  return container.querySelector(`[data-testid="${testId}"]`);
}

async function setValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

  await act(async () => {
    valueSetter?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    await Promise.resolve();
  });
}

async function submitForm(form: HTMLElement) {
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
}

async function clickElement(element: HTMLElement) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
  });
}

describe('ExplorerAdminPanel', () => {
  beforeEach(() => {
    trpcMocks.campaignQuery.data = null;
    trpcMocks.campaignQuery.error = null;
    trpcMocks.campaignQuery.isLoading = false;
    trpcMocks.invalidate.mockClear();
    trpcMocks.validateSegment.mockReset();
    trpcMocks.validateSegment.mockResolvedValue({
      strava_segment_id: '2234642',
      name: 'Box Hill KOM',
      distance: 2931,
      average_grade: 5.4,
      city: 'Dorking',
      state: 'Surrey',
      country: 'United Kingdom',
    });
    trpcMocks.createCampaign.mockReset();
    trpcMocks.createCampaign.mockResolvedValue({ id: 1 });
    trpcMocks.addDestination.mockReset();
    trpcMocks.addDestination.mockResolvedValue({
      id: 1,
      cached_name: 'Segment 2234642',
      strava_segment_id: '2234642',
      usedPlaceholderMetadata: false,
    });
    vi.useRealTimers();
  });

  afterEach(async () => {
    if (renderResult) {
      await act(async () => {
        renderResult?.root.unmount();
      });
      renderResult.container.remove();
      renderResult = null;
    }

    vi.useRealTimers();
  });

  it('shows an access denied state for non-admin users', async () => {
    const { container } = await renderPanel({ isAdmin: false });

    expect(getByTestId(container, 'explorer-admin-panel').textContent).toContain('Access Denied');
    expect(container.textContent).toContain('do not have admin permissions');
  });

  it('falls back to the first season when no admin season is selected', async () => {
    const { container } = await renderPanel({ selectedSeasonId: null });

    expect(getByTestId(container, 'explorer-season-summary').textContent).toContain('Spring 2026');

    await submitForm(getByTestId(container, 'explorer-create-campaign-form'));

    expect(trpcMocks.createCampaign).toHaveBeenCalledWith({
      seasonId: 7,
      displayName: null,
      rulesBlurb: null,
    });
    expect(trpcMocks.invalidate).toHaveBeenCalledWith({ seasonId: 7 });
  });

  it('falls back to the first season when the selected season is missing', async () => {
    const { container } = await renderPanel({ selectedSeasonId: 999 });

    expect(getByTestId(container, 'explorer-season-summary').textContent).toContain('Spring 2026');
  });

  it('shows the empty state when there are no seasons to configure', async () => {
    const { container } = await renderPanel({ seasons: [], selectedSeasonId: null });

    expect(container.textContent).toContain('No seasons available');
    expect(queryByTestId(container, 'explorer-create-campaign-form')).toBeNull();
  });

  it('auto-previews, accepts, and rejects destinations while preserving the latest flash message timer', async () => {
    vi.useFakeTimers();
    trpcMocks.campaignQuery.data = {
      id: 41,
      name: 'Spring 2026 Explorer',
      rulesBlurb: 'Ride every destination once.',
      destinations: [],
    };
    trpcMocks.addDestination
      .mockResolvedValueOnce({
        id: 1,
        cached_name: 'Segment 2234642',
        strava_segment_id: '2234642',
        usedPlaceholderMetadata: true,
      })
      .mockResolvedValueOnce({
        id: 2,
        cached_name: 'Box Hill KOM',
        strava_segment_id: '2234642',
        usedPlaceholderMetadata: false,
      });

    const { container } = await renderPanel();

    await setValue(
      getByTestId(container, 'explorer-source-url-input') as HTMLInputElement,
      '  https://www.strava.com/segments/2234642  '
    );
    await act(async () => {
      vi.advanceTimersByTime(150);
      await Promise.resolve();
    });

    expect(getByTestId(container, 'explorer-destination-preview-card').textContent).toContain('Box Hill KOM');
    expect(getByTestId(container, 'explorer-destination-preview-card').textContent).toContain('2.93 km');

    await clickElement(getByTestId(container, 'explorer-reject-preview-button'));
    expect(queryByTestId(container, 'explorer-destination-preview-card')).toBeNull();

    await setValue(
      getByTestId(container, 'explorer-source-url-input') as HTMLInputElement,
      'https://www.strava.com/segments/2234642'
    );
    await act(async () => {
      vi.advanceTimersByTime(150);
      await Promise.resolve();
    });
    await clickElement(getByTestId(container, 'explorer-accept-preview-button'));

    expect(getByTestId(container, 'explorer-admin-message').textContent).toContain('placeholder metadata');
    expect(trpcMocks.addDestination).toHaveBeenNthCalledWith(1, {
      explorerCampaignId: 41,
      sourceUrl: 'https://www.strava.com/segments/2234642',
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    await setValue(
      getByTestId(container, 'explorer-source-url-input') as HTMLInputElement,
      'https://www.strava.com/segments/2234642'
    );
    await act(async () => {
      vi.advanceTimersByTime(150);
      await Promise.resolve();
    });

    expect(getByTestId(container, 'explorer-preview-name').textContent).toContain('Box Hill KOM');

    await clickElement(getByTestId(container, 'explorer-accept-preview-button'));

    expect(getByTestId(container, 'explorer-admin-message').textContent).toContain('Destination added to the Explorer campaign.');
    expect(trpcMocks.addDestination).toHaveBeenNthCalledWith(2, {
      explorerCampaignId: 41,
      sourceUrl: 'https://www.strava.com/segments/2234642',
    });

    await act(async () => {
      vi.advanceTimersByTime(4000);
    });

    expect(getByTestId(container, 'explorer-admin-message').textContent).toContain('Destination added to the Explorer campaign.');

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(queryByTestId(container, 'explorer-admin-message')).toBeNull();
  });

  it('requests a single preview validation for each source-url change', async () => {
    vi.useFakeTimers();
    trpcMocks.campaignQuery.data = {
      id: 41,
      name: 'Spring 2026 Explorer',
      rulesBlurb: 'Ride every destination once.',
      destinations: [],
    };

    const { container } = await renderPanel();

    await setValue(
      getByTestId(container, 'explorer-source-url-input') as HTMLInputElement,
      'https://www.strava.com/segments/2234642'
    );

    await act(async () => {
      vi.advanceTimersByTime(150);
      await Promise.resolve();
    });

    expect(trpcMocks.validateSegment).toHaveBeenCalledTimes(1);
    expect(trpcMocks.validateSegment).toHaveBeenCalledWith('2234642');
  });

  it('ignores stale preview responses when the source URL changes mid-request', async () => {
    vi.useFakeTimers();
    trpcMocks.campaignQuery.data = {
      id: 41,
      name: 'Spring 2026 Explorer',
      rulesBlurb: 'Ride every destination once.',
      destinations: [],
    };

    const firstPreview = createDeferredValue({
      strava_segment_id: '2234642',
      name: 'Older Preview',
      distance: 1000,
      average_grade: 2.1,
      city: 'Oldtown',
      state: 'MA',
      country: 'USA',
    });
    const secondPreview = createDeferredValue({
      strava_segment_id: '9999999',
      name: 'Newest Preview',
      distance: 4500,
      average_grade: 6.2,
      city: 'Newtown',
      state: 'VT',
      country: 'USA',
    });

    trpcMocks.validateSegment.mockReset();
    trpcMocks.validateSegment
      .mockReturnValueOnce(firstPreview.promise)
      .mockReturnValueOnce(secondPreview.promise);

    const { container } = await renderPanel();

    await setValue(
      getByTestId(container, 'explorer-source-url-input') as HTMLInputElement,
      'https://www.strava.com/segments/2234642'
    );
    await act(async () => {
      vi.advanceTimersByTime(150);
      await Promise.resolve();
    });

    await setValue(
      getByTestId(container, 'explorer-source-url-input') as HTMLInputElement,
      'https://www.strava.com/segments/9999999'
    );
    await act(async () => {
      vi.advanceTimersByTime(150);
      await Promise.resolve();
    });

    await act(async () => {
      firstPreview.resolve({
        strava_segment_id: '2234642',
        name: 'Older Preview',
        distance: 1000,
        average_grade: 2.1,
        city: 'Oldtown',
        state: 'MA',
        country: 'USA',
      });
      await Promise.resolve();
    });

    expect(queryByTestId(container, 'explorer-destination-preview-card')).toBeNull();

    await act(async () => {
      secondPreview.resolve({
        strava_segment_id: '9999999',
        name: 'Newest Preview',
        distance: 4500,
        average_grade: 6.2,
        city: 'Newtown',
        state: 'VT',
        country: 'USA',
      });
      await Promise.resolve();
    });

    expect(getByTestId(container, 'explorer-destination-preview-card').textContent).toContain('Newest Preview');
    expect(getByTestId(container, 'explorer-destination-preview-card').textContent).not.toContain('Older Preview');
  });

  it('renders richer destination cards when a campaign already has destinations', async () => {
    trpcMocks.campaignQuery.data = {
      id: 41,
      name: 'Spring 2026 Explorer',
      rulesBlurb: 'Ride every destination once.',
      destinations: [
        {
          id: 99,
          displayLabel: 'Box Hill opener',
          customLabel: 'Box Hill opener',
          segmentName: 'Box Hill KOM',
          displayOrder: 0,
          sourceUrl: 'https://www.strava.com/segments/2234642',
          stravaSegmentId: '2234642',
          createdAt: '2026-04-17 13:15:00',
          distance: 2931,
          averageGrade: 5.4,
          city: 'Dorking',
          state: 'Surrey',
          country: 'United Kingdom',
        },
      ],
    };

    const { container } = await renderPanel();

    expect(getByTestId(container, 'explorer-destination-row-99').textContent).toContain('Box Hill opener');
    expect(getByTestId(container, 'explorer-destination-row-99').textContent).toContain('2.93 km');
    expect(getByTestId(container, 'explorer-destination-row-99').textContent).toContain('5.4% avg grade');
    expect(getByTestId(container, 'explorer-destination-row-99').textContent).toContain('Dorking, Surrey, United Kingdom');

    await clickElement(getByTestId(container, 'explorer-destination-toggle-99'));

    expect(getByTestId(container, 'explorer-destination-row-99').textContent).toContain('Original segment name: Box Hill KOM');
    expect(getByTestId(container, 'explorer-destination-row-99').textContent).toContain('Added');
  });
});