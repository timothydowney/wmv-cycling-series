import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dateToUnixEnd, dateToUnixStart } from '../../utils/dateUtils';
import ExplorerAdminPanel from '../ExplorerAdminPanel';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const trpcMocks = vi.hoisted(() => ({
  campaignsQuery: {
    data: [] as Array<{
      id: number;
      name: string;
      startAt: number;
      endAt: number;
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
    }>,
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
  createCampaign: vi.fn(async (_input?: unknown) => ({
    id: 91,
    start_at: 1748736000,
    end_at: 1751327999,
    display_name: 'Explorer June',
  })),
  updateCampaign: vi.fn(async (_input?: unknown) => ({
    id: 41,
    start_at: 1748736000,
    end_at: 1751327999,
    display_name: 'Updated Explorer',
  })),
  addDestination: vi.fn(async (_input?: unknown) => ({
    id: 201,
    cached_name: 'Box Hill KOM',
    strava_segment_id: '2234642',
    usedPlaceholderMetadata: false,
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
        getCampaigns: {
          invalidate: trpcMocks.invalidate,
        },
      },
    }),
    explorerAdmin: {
      getCampaigns: {
        useQuery: () => trpcMocks.campaignsQuery,
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
      updateCampaign: {
        useMutation: (options: {
          onError?: (error: Error) => void;
          onSuccess?: (result: unknown) => Promise<void> | void;
        }) => ({
          isPending: false,
          mutateAsync: async (input: unknown) => {
            try {
              const result = await trpcMocks.updateCampaign(input);
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
            id: number;
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

interface RenderResult {
  container: HTMLDivElement;
  root: Root;
}

let renderResult: RenderResult | null = null;

async function renderPanel(overrides: Partial<ComponentProps<typeof ExplorerAdminPanel>> = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<ExplorerAdminPanel isAdmin {...overrides} />);
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
    trpcMocks.campaignsQuery.data = [];
    trpcMocks.campaignsQuery.error = null;
    trpcMocks.campaignsQuery.isLoading = false;
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
    trpcMocks.createCampaign.mockResolvedValue({
      id: 91,
      start_at: 1748736000,
      end_at: 1751327999,
      display_name: 'Explorer June',
    });
    trpcMocks.updateCampaign.mockReset();
    trpcMocks.updateCampaign.mockResolvedValue({
      id: 41,
      start_at: 1748736000,
      end_at: 1751327999,
      display_name: 'Updated Explorer',
    });
    trpcMocks.addDestination.mockReset();
    trpcMocks.addDestination.mockResolvedValue({
      id: 201,
      cached_name: 'Box Hill KOM',
      strava_segment_id: '2234642',
      usedPlaceholderMetadata: false,
    });
    vi.useRealTimers();
  });

  afterEach(async () => {
    if (renderResult) {
      await act(async () => {
        renderResult.root.unmount();
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

  it('creates a campaign with date-bound input', async () => {
    const { container } = await renderPanel();

    await setValue(getByTestId(container, 'explorer-display-name-input') as HTMLInputElement, 'Explorer June');
    await setValue(getByTestId(container, 'explorer-start-date-input') as HTMLInputElement, '2025-06-01');
    await setValue(getByTestId(container, 'explorer-end-date-input') as HTMLInputElement, '2025-06-30');
    await setValue(getByTestId(container, 'explorer-rules-blurb-input') as HTMLTextAreaElement, 'Ride every destination once.');

    await submitForm(getByTestId(container, 'explorer-create-campaign-form'));

    expect(trpcMocks.createCampaign).toHaveBeenCalledWith({
      startAt: dateToUnixStart('2025-06-01'),
      endAt: dateToUnixEnd('2025-06-30'),
      displayName: 'Explorer June',
      rulesBlurb: 'Ride every destination once.',
    });
    expect(trpcMocks.invalidate).toHaveBeenCalled();
    expect(getByTestId(container, 'explorer-admin-message').textContent).toContain('Explorer campaign created.');
  });

  it('updates an existing campaign from the expanded card', async () => {
    trpcMocks.campaignsQuery.data = [
      {
        id: 41,
        name: 'Spring Explorer',
        startAt: 1748736000,
        endAt: 1751327999,
        rulesBlurb: 'Ride every destination once.',
        destinations: [],
      },
    ];

    const { container } = await renderPanel();

    await setValue(getByTestId(container, 'explorer-campaign-name-input-41') as HTMLInputElement, 'Updated Explorer');
    await setValue(getByTestId(container, 'explorer-campaign-start-date-input-41') as HTMLInputElement, '2025-06-02');
    await setValue(getByTestId(container, 'explorer-campaign-end-date-input-41') as HTMLInputElement, '2025-06-29');
    await setValue(getByTestId(container, 'explorer-campaign-rules-input-41') as HTMLTextAreaElement, 'Updated rules.');
    await clickElement(getByTestId(container, 'explorer-save-campaign-button-41'));

    expect(trpcMocks.updateCampaign).toHaveBeenCalledWith({
      explorerCampaignId: 41,
      startAt: dateToUnixStart('2025-06-02'),
      endAt: dateToUnixEnd('2025-06-29'),
      displayName: 'Updated Explorer',
      rulesBlurb: 'Updated rules.',
    });
  });

  it('auto-previews, rejects, and accepts destinations for the expanded campaign', async () => {
    vi.useFakeTimers();
    trpcMocks.campaignsQuery.data = [
      {
        id: 41,
        name: 'Spring Explorer',
        startAt: 1748736000,
        endAt: 1751327999,
        rulesBlurb: 'Ride every destination once.',
        destinations: [],
      },
    ];

    const { container } = await renderPanel();

    await setValue(
      getByTestId(container, 'explorer-source-url-input') as HTMLInputElement,
      'https://www.strava.com/segments/2234642'
    );

    await act(async () => {
      vi.advanceTimersByTime(150);
      await Promise.resolve();
    });

    expect(trpcMocks.validateSegment).toHaveBeenCalledWith('2234642');
    expect(getByTestId(container, 'explorer-preview-name').textContent).toContain('Box Hill KOM');

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

    expect(trpcMocks.addDestination).toHaveBeenCalledWith({
      explorerCampaignId: 41,
      sourceUrl: 'https://www.strava.com/segments/2234642',
    });
    expect(getByTestId(container, 'explorer-admin-message').textContent).toContain('Destination added to the Explorer campaign.');
  });

  it('renders and expands existing destinations inside the campaign shell', async () => {
    trpcMocks.campaignsQuery.data = [
      {
        id: 41,
        name: 'Spring Explorer',
        startAt: 1748736000,
        endAt: 1751327999,
        rulesBlurb: 'Ride every destination once.',
        destinations: [
          {
            id: 301,
            displayLabel: 'Hilltown opener',
            customLabel: null,
            segmentName: 'Hilltown opener',
            displayOrder: 0,
            sourceUrl: 'https://www.strava.com/segments/2234642',
            stravaSegmentId: '2234642',
            createdAt: '2025-06-03T09:05:00Z',
            distance: 2931,
            averageGrade: 5.4,
            city: 'Dorking',
            state: 'Surrey',
            country: 'United Kingdom',
          },
        ],
      },
    ];

    const { container } = await renderPanel();

    expect(getByTestId(container, 'explorer-destination-list').textContent).toContain('Hilltown opener');
    await clickElement(getByTestId(container, 'explorer-destination-toggle-301'));
    expect(getByTestId(container, 'explorer-destination-row-301').textContent).toContain('Added');
  });
});
