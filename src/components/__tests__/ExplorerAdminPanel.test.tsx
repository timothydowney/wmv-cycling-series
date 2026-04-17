import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Season } from '../../types';
import ExplorerAdminPanel from '../ExplorerAdminPanel';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const trpcMocks = vi.hoisted(() => ({
  campaignQuery: {
    data: null as null | {
      id: number;
      name: string;
      rulesBlurb: string | null;
      destinations: Array<{
        id: number;
        displayLabel: string;
        displayOrder: number;
        sourceUrl: string | null;
        stravaSegmentId: string;
      }>;
    },
    error: null as Error | null,
    isLoading: false,
  },
  invalidate: vi.fn(async () => undefined),
  createCampaign: vi.fn(async () => ({ id: 1 })),
  addDestination: vi.fn(async () => ({
    id: 1,
    cached_name: 'Segment 1',
    strava_segment_id: '1',
    usedPlaceholderMetadata: true,
  })),
}));

vi.mock('../../utils/trpc', () => ({
  trpc: {
    useUtils: () => ({
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

let renderResult: RenderResult | null = null;

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

describe('ExplorerAdminPanel', () => {
  beforeEach(() => {
    trpcMocks.campaignQuery.data = null;
    trpcMocks.campaignQuery.error = null;
    trpcMocks.campaignQuery.isLoading = false;
    trpcMocks.invalidate.mockClear();
    trpcMocks.createCampaign.mockReset();
    trpcMocks.createCampaign.mockResolvedValue({ id: 1 });
    trpcMocks.addDestination.mockReset();
    trpcMocks.addDestination.mockResolvedValue({
      id: 1,
      cached_name: 'Segment 2234642',
      strava_segment_id: '2234642',
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

  it('adds destinations with trimmed values and preserves the latest flash message timer', async () => {
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
    await submitForm(getByTestId(container, 'explorer-add-destination-form'));

    expect(getByTestId(container, 'explorer-admin-message').textContent).toContain('placeholder metadata');
    expect(trpcMocks.addDestination).toHaveBeenNthCalledWith(1, {
      explorerCampaignId: 41,
      sourceUrl: 'https://www.strava.com/segments/2234642',
      displayLabel: null,
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    await setValue(
      getByTestId(container, 'explorer-source-url-input') as HTMLInputElement,
      'https://www.strava.com/segments/2234642'
    );
    await setValue(
      getByTestId(container, 'explorer-display-label-input') as HTMLInputElement,
      '  Box Hill opener  '
    );
    await submitForm(getByTestId(container, 'explorer-add-destination-form'));

    expect(getByTestId(container, 'explorer-admin-message').textContent).toContain('Destination added to the Explorer campaign.');
    expect(trpcMocks.addDestination).toHaveBeenNthCalledWith(2, {
      explorerCampaignId: 41,
      sourceUrl: 'https://www.strava.com/segments/2234642',
      displayLabel: 'Box Hill opener',
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
});