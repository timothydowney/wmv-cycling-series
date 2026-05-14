import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SubscriptionStatusCard from '../WebhookComponents/SubscriptionStatusCard';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { useMutationMock } = vi.hoisted(() => ({
  useMutationMock: vi.fn(),
}));

vi.mock('../../utils/trpc', () => ({
  trpc: {
    webhookAdmin: {
      enable: {
        useMutation: (...args: unknown[]) => useMutationMock(...args),
      },
      disable: {
        useMutation: (...args: unknown[]) => useMutationMock(...args),
      },
      renew: {
        useMutation: (...args: unknown[]) => useMutationMock(...args),
      },
    },
  },
}));

interface RenderResult {
  container: HTMLDivElement;
  root: Root;
}

let renderResult: RenderResult | null = null;

const baseSubscription = {
  enabled: true,
  subscription_id: 123,
  created_at: '2026-05-10T00:00:00.000Z',
  expires_at: '2026-05-14T00:00:00.000Z',
  last_refreshed_at: '2026-05-13T00:00:00.000Z',
  metrics: {
    total_events: 0,
    successful_events: 0,
    failed_events: 0,
    pending_retries: 0,
    events_last24h: 0,
    success_rate: 0,
  },
  diagnostics: {
    delivery_health: 'healthy',
    config: {
      webhook_enabled: true,
      persist_events: true,
    },
    last_receipt_at: null,
    last_success_at: null,
    last_failure_at: null,
    last_failure_error: null,
    warnings: [],
  },
};

async function renderCard(overrides: Partial<typeof baseSubscription> = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <SubscriptionStatusCard
        subscription={{ ...baseSubscription, ...overrides }}
        onStatusUpdate={async () => undefined}
      />
    );
  });

  renderResult = { container, root };
  return renderResult;
}

describe('SubscriptionStatusCard renewal semantics', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-13T12:00:00.000Z'));
    useMutationMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
  });

  afterEach(async () => {
    vi.clearAllMocks();
    vi.useRealTimers();

    if (renderResult) {
      await act(async () => {
        renderResult?.root.unmount();
      });
      renderResult.container.remove();
      renderResult = null;
    }
  });

  it('shows fresh renewal state and scheduler cadence copy', async () => {
    const { container } = await renderCard({
      expires_at: '2026-05-14T11:00:00.000Z',
      last_refreshed_at: '2026-05-13T11:00:00.000Z',
    });

    expect(container.textContent).toContain('Time remaining:');
    expect(container.textContent).toContain('23h 0m');
    expect(container.textContent).toContain('Last renewed:');
    expect(container.textContent).toContain('1h 0m ago');
    expect(container.textContent).toContain('Checks every 6h; renews after ~22h since last refresh');
  });

  it('shows near-renewal warning when expiration window is close', async () => {
    const { container } = await renderCard({
      expires_at: '2026-05-13T13:30:00.000Z',
      last_refreshed_at: '2026-05-12T13:30:00.000Z',
    });

    expect(container.textContent).toContain('1h 30m');
    expect(container.textContent).toContain('⚠ Expiring soon');
  });

  it('shows expired state from backend expiry even when created_at looks recent', async () => {
    const { container } = await renderCard({
      created_at: '2026-05-13T11:55:00.000Z',
      expires_at: '2026-05-13T10:00:00.000Z',
      last_refreshed_at: '2026-05-12T10:00:00.000Z',
    });

    expect(container.textContent).toContain('Expired');
    expect(container.textContent).toContain('(expired - renew to reactivate)');
  });

  it('renders safely when diagnostics payload is missing', async () => {
    const { container } = await renderCard({
      diagnostics: undefined as any,
    });

    expect(container.textContent).toContain('Webhooks Active');
    expect(container.textContent).toContain('Runtime flags unavailable until backend diagnostics payload is enabled.');
  });

  it('renders troubleshooting warnings when diagnostics are present', async () => {
    const { container } = await renderCard({
      diagnostics: {
        delivery_health: 'degraded',
        config: {
          webhook_enabled: true,
          persist_events: true,
        },
        last_receipt_at: '2026-05-13T10:00:00.000Z',
        last_success_at: null,
        last_failure_at: '2026-05-13T10:30:00.000Z',
        last_failure_error: 'Token refresh failed',
        warnings: [
          {
            code: 'NO_RECEIPTS_24H',
            severity: 'degraded',
            message: 'Subscription appears active but no webhook receipts were recorded in the last 24 hours.',
          },
        ],
      },
    });

    expect(container.textContent).toContain('Troubleshooting warnings');
    expect(container.textContent).toContain('Token refresh failed');
    expect(container.textContent).toContain('WEBHOOK_ENABLED=true');
  });
});
