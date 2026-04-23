import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WebhookActivityEventCard from '../WebhookComponents/WebhookActivityEventCard';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const {
  getEnrichedEventDetailsUseQuery,
  replayEventUseMutation,
  invalidateMock,
} = vi.hoisted(() => ({
  getEnrichedEventDetailsUseQuery: vi.fn(),
  replayEventUseMutation: vi.fn(),
  invalidateMock: vi.fn(),
}));

vi.mock('../../utils/trpc', () => ({
  trpc: {
    webhookAdmin: {
      getEnrichedEventDetails: {
        useQuery: (...args: unknown[]) => getEnrichedEventDetailsUseQuery(...args),
      },
      replayEvent: {
        useMutation: (...args: unknown[]) => replayEventUseMutation(...args),
      },
      getEvents: {
        invalidate: invalidateMock,
      },
    },
    useUtils: () => ({
      webhookAdmin: {
        getEvents: {
          invalidate: invalidateMock,
        },
      },
    }),
  },
}));

interface RenderResult {
  container: HTMLDivElement;
  root: Root;
}

let renderResult: RenderResult | null = null;

const baseEvent = {
  id: 12,
  created_at: '2026-04-22T10:00:00Z',
  processed: true,
  error_message: null,
  athlete_name: 'Alice',
  payload: {
    aspect_type: 'create' as const,
    event_time: 1713780000,
    object_id: 987654,
    object_type: 'activity' as const,
    owner_id: 777,
    subscription_id: 1,
  },
  activity_summary: {
    outcome: 'both' as const,
    competition_week_count: 1,
    competition_season_count: 1,
    explorer_destination_count: 2,
    explorer_campaign_count: 1,
    competition_week_names: ['Week 4 Time Trial'],
    explorer_destination_names: ['Summit Road', 'River Loop'],
    message: 'Matched 1 competition week(s) and 2 Explorer destination(s)',
  },
};

async function renderCard() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<WebhookActivityEventCard event={baseEvent} />);
  });

  renderResult = { container, root };
  return renderResult;
}

describe('WebhookActivityEventCard', () => {
  afterEach(async () => {
    vi.clearAllMocks();

    if (renderResult) {
      await act(async () => {
        renderResult?.root.unmount();
      });
      renderResult.container.remove();
      renderResult = null;
    }
  });

  it('shows collapsed summary badges and only enables enrichment after expansion', async () => {
    getEnrichedEventDetailsUseQuery.mockReturnValue({
      data: {
        athlete: {
          athlete_id: '777',
          name: 'Alice',
        },
        strava_data: null,
        activity_detail: {
          status: 'private_or_unavailable',
          message: 'Activity details are not currently visible on Strava. This usually means the activity is still private.',
          cached: false,
        },
      },
      isLoading: false,
      error: null,
    });

    replayEventUseMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });

    const { container } = await renderCard();

    expect(container.textContent).toContain('Create');
    expect(container.textContent).toContain('Competition + Explorer');
    expect(container.textContent).toContain('Week: Week 4 Time Trial');
    expect(container.textContent).toContain('Destination: Summit Road +1');
    expect(container.textContent).toContain('Matched 1 competition week(s) and 2 Explorer destination(s)');
    expect(container.textContent).toContain('Private or unavailable');

    const initialCall = getEnrichedEventDetailsUseQuery.mock.calls.at(-1);
    expect(initialCall?.[1]).toMatchObject({ enabled: false, staleTime: 300000 });

    const expandButton = container.querySelector('.collapse-btn') as HTMLButtonElement | null;
    expect(expandButton).not.toBeNull();

    await act(async () => {
      expandButton?.click();
    });

    const expandedCall = getEnrichedEventDetailsUseQuery.mock.calls.at(-1);
    expect(expandedCall?.[1]).toMatchObject({ enabled: true, staleTime: 300000 });
  });
});