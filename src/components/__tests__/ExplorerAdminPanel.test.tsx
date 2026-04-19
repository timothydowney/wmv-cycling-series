import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dateToUnixEnd, dateToUnixStart, unixToDateLocal } from '../../utils/dateUtils';
import ExplorerAdminPanel from '../ExplorerAdminPanel';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const trpcMocks = vi.hoisted(() => ({
  campaignsQuery: {
    data: [] as Array<{
      id: number;
      name: string;
      displayNameRaw: string | null;
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
  deleteDestination: vi.fn(async (_input?: unknown) => ({
    explorerDestinationId: 201,
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
      deleteDestination: {
        useMutation: (options: {
          onError?: (error: Error) => void;
          onSuccess?: (result: { explorerDestinationId: number }) => Promise<void> | void;
        }) => ({
          isPending: false,
          mutateAsync: async (input: unknown) => {
            try {
              const result = await trpcMocks.deleteDestination(input);
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

interface DeferredValue<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

let renderResult: RenderResult | null = null;
const FIXED_NOW = new Date('2026-06-15T12:00:00Z');

function createDeferredValue<T>(): DeferredValue<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

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
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);

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
    trpcMocks.deleteDestination.mockReset();
    trpcMocks.deleteDestination.mockResolvedValue({ explorerDestinationId: 201 });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(async () => {
    if (renderResult) {
      await act(async () => {
        renderResult.root.unmount();
      });
      renderResult.container.remove();
      renderResult = null;
    }

    vi.restoreAllMocks();
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
        displayNameRaw: 'Spring Explorer',
        startAt: 1767225600,
        endAt: 1798761599,
        rulesBlurb: 'Ride every destination once.',
        destinations: [],
      },
    ];

    const { container } = await renderPanel();

    expect(queryByTestId(container, 'explorer-campaign-name-input-41')).toBeNull();

    await clickElement(getByTestId(container, 'explorer-edit-campaign-button-41'));

    const editForm = getByTestId(container, 'explorer-campaign-edit-form-41');
    const destinationCard = getByTestId(container, 'explorer-add-destination-card');
    expect(editForm.compareDocumentPosition(destinationCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

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
    expect(queryByTestId(container, 'explorer-campaign-name-input-41')).toBeNull();
  });

  it('cancels campaign edits and restores the saved values', async () => {
    trpcMocks.campaignsQuery.data = [
      {
        id: 41,
        name: 'Spring Explorer',
        displayNameRaw: 'Spring Explorer',
        startAt: 1767225600,
        endAt: 1798761599,
        rulesBlurb: 'Ride every destination once.',
        destinations: [],
      },
    ];

    const { container } = await renderPanel();

    await clickElement(getByTestId(container, 'explorer-edit-campaign-button-41'));
    await setValue(getByTestId(container, 'explorer-campaign-name-input-41') as HTMLInputElement, 'Changed title');
    await setValue(getByTestId(container, 'explorer-campaign-rules-input-41') as HTMLTextAreaElement, 'Changed rules.');

    await clickElement(getByTestId(container, 'explorer-cancel-campaign-button-41'));

    expect(queryByTestId(container, 'explorer-campaign-name-input-41')).toBeNull();
    expect(trpcMocks.updateCampaign).not.toHaveBeenCalled();

    await clickElement(getByTestId(container, 'explorer-edit-campaign-button-41'));

    expect((getByTestId(container, 'explorer-campaign-name-input-41') as HTMLInputElement).value).toBe('Spring Explorer');
    expect((getByTestId(container, 'explorer-campaign-rules-input-41') as HTMLTextAreaElement).value).toBe('Ride every destination once.');
  });

  it('does not render a separate campaign details panel when not editing', async () => {
    trpcMocks.campaignsQuery.data = [
      {
        id: 41,
        name: 'Spring Explorer',
        displayNameRaw: 'Spring Explorer',
        startAt: 1767225600,
        endAt: 1798761599,
        rulesBlurb: 'Ride every destination once.',
        destinations: [],
      },
    ];

    const { container } = await renderPanel();

    expect(queryByTestId(container, 'explorer-campaign-edit-form-41')).toBeNull();
    expect(queryByTestId(container, 'explorer-campaign-details-toggle-41')).toBeNull();
  });

  it('auto-previews, rejects, and accepts destinations for the expanded campaign', async () => {
    trpcMocks.campaignsQuery.data = [
      {
        id: 41,
        name: 'Spring Explorer',
        displayNameRaw: 'Spring Explorer',
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
        displayNameRaw: 'Spring Explorer',
        startAt: 1767225600,
        endAt: 1798761599,
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

    expect(getByTestId(container, 'explorer-primary-campaign-label').textContent).toContain('Current campaign');
    const searchInput = getByTestId(container, 'explorer-destination-search-stub-41').querySelector('input') as HTMLInputElement;
    expect(searchInput.placeholder).toContain('already in this campaign');
    expect(getByTestId(container, 'explorer-destination-list').textContent).toContain('Hilltown opener');
    await clickElement(getByTestId(container, 'explorer-destination-toggle-301'));
    expect(getByTestId(container, 'explorer-destination-row-301').textContent).toContain('Added');
  });

  it('uses icon-only summary actions and keeps the caret as a dedicated collapse control', async () => {
    trpcMocks.campaignsQuery.data = [
      {
        id: 41,
        name: 'Spring Explorer',
        displayNameRaw: 'Spring Explorer',
        startAt: 1767225600,
        endAt: 1798761599,
        rulesBlurb: 'Ride every destination once.',
        destinations: [],
      },
    ];

    const { container } = await renderPanel();

    expect(getByTestId(container, 'explorer-edit-campaign-button-41').textContent).toBe('');

    await clickElement(getByTestId(container, 'explorer-campaign-summary-caret-41'));

    expect(queryByTestId(container, 'explorer-add-destination-card')).toBeNull();
  });

  it('promotes the next upcoming campaign when none is currently active', async () => {
    trpcMocks.campaignsQuery.data = [
      {
        id: 52,
        name: 'Past Explorer',
        displayNameRaw: 'Past Explorer',
        startAt: 1704067200,
        endAt: 1706659199,
        rulesBlurb: null,
        destinations: [],
      },
      {
        id: 53,
        name: 'Next Explorer',
        displayNameRaw: 'Next Explorer',
        startAt: 1893456000,
        endAt: 1896047999,
        rulesBlurb: null,
        destinations: [],
      },
    ];

    const { container } = await renderPanel();

    expect(getByTestId(container, 'explorer-campaign-name').textContent).toContain('Next Explorer');
    expect(getByTestId(container, 'explorer-primary-campaign-label').textContent).toContain('Next campaign');
  });

  it('shows create campaign near the top when there is no current or upcoming campaign', async () => {
    trpcMocks.campaignsQuery.data = [
      {
        id: 52,
        name: 'Past Explorer',
        displayNameRaw: 'Past Explorer',
        startAt: 1704067200,
        endAt: 1706659199,
        rulesBlurb: null,
        destinations: [],
      },
    ];

    const { container } = await renderPanel();

    expect(getByTestId(container, 'explorer-display-name-input')).not.toBeNull();
    expect(queryByTestId(container, 'explorer-primary-campaign-label')).toBeNull();
  });

  it('deletes a destination after confirmation', async () => {
    trpcMocks.campaignsQuery.data = [
      {
        id: 41,
        name: 'Spring Explorer',
        displayNameRaw: 'Spring Explorer',
        startAt: 1748736000,
        endAt: 1751327999,
        rulesBlurb: 'Ride every destination once.',
        destinations: [
          {
            id: 201,
            displayLabel: 'Box Hill KOM',
            customLabel: null,
            segmentName: 'Box Hill KOM',
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

    await clickElement(getByTestId(container, 'explorer-delete-destination-button-201'));

    expect(window.confirm).toHaveBeenCalledWith('Remove Box Hill KOM from this Explorer campaign?');
    expect(trpcMocks.deleteDestination).toHaveBeenCalledWith({ explorerDestinationId: 201 });
    expect(getByTestId(container, 'explorer-admin-message').textContent).toContain('Destination removed');
  });

  it('preserves an explicit Explorer Campaign display name when saving', async () => {
    trpcMocks.campaignsQuery.data = [
      {
        id: 41,
        name: 'Explorer Campaign',
        displayNameRaw: 'Explorer Campaign',
        startAt: 1748736000,
        endAt: 1751327999,
        rulesBlurb: null,
        destinations: [],
      },
    ];

    const { container } = await renderPanel();

    await clickElement(getByTestId(container, 'explorer-edit-campaign-button-41'));

    expect((getByTestId(container, 'explorer-campaign-name-input-41') as HTMLInputElement).value).toBe('Explorer Campaign');

    await clickElement(getByTestId(container, 'explorer-save-campaign-button-41'));

    expect(trpcMocks.updateCampaign).toHaveBeenCalledWith({
      explorerCampaignId: 41,
      startAt: dateToUnixStart(unixToDateLocal(1748736000)),
      endAt: dateToUnixEnd(unixToDateLocal(1751327999)),
      displayName: 'Explorer Campaign',
      rulesBlurb: null,
    });
  });

  it('ignores stale preview responses when the source URL changes mid-request', async () => {
    trpcMocks.campaignsQuery.data = [
      {
        id: 41,
        name: 'Spring Explorer',
        displayNameRaw: 'Spring Explorer',
        startAt: 1748736000,
        endAt: 1751327999,
        rulesBlurb: 'Ride every destination once.',
        destinations: [],
      },
    ];

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
});
