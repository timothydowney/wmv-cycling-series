import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppContent } from '../../App';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockAuthStatusUseQuery = vi.fn();
const mockSeasonUseQuery = vi.fn();

vi.mock('../../utils/trpc', () => ({
  trpc: {
    useUtils: () => ({
      leaderboard: { getWeekLeaderboard: { invalidate: vi.fn() } },
      season: { getAll: { invalidate: vi.fn() } },
    }),
    participant: { getAuthStatus: { useQuery: () => mockAuthStatusUseQuery() } },
    season: { getAll: { useQuery: () => mockSeasonUseQuery() } },
    createClient: vi.fn(),
    Provider: ({ children }: { children: React.ReactNode }) => children,
  },
}));

vi.mock('../../components/WeeklyLeaderboard', () => ({ default: () => <div>Weekly Leaderboard Content</div> }));
vi.mock('../../components/SeasonLeaderboard', () => ({ default: () => <div>Season Leaderboard Content</div> }));
vi.mock('../../components/ScheduleTable', () => ({ default: () => <div>Schedule Content</div> }));
vi.mock('../../components/SeasonWeekSelectors', () => ({ default: () => <div>Season Week Selectors</div> }));
vi.mock('../../components/NavBar', () => ({
  default: ({ title }: { title?: string }) => <div data-testid="mock-navbar-title">{title}</div>,
}));
vi.mock('../../components/BottomNav', () => ({ default: () => <div>Bottom Nav</div> }));
vi.mock('../../components/AdminPanel', () => ({ default: () => <div>Admin Panel</div> }));
vi.mock('../../components/AdminRoleManager', () => ({ default: () => <div>Roles</div> }));
vi.mock('../../components/ParticipantStatus', () => ({ default: () => <div>Participants</div> }));
vi.mock('../../components/ManageSegments', () => ({ default: () => <div>Segments</div> }));
vi.mock('../../components/SeasonManager', () => ({ default: () => <div>Seasons</div> }));
vi.mock('../../components/WebhookManagementPanel', () => ({ default: () => <div>Webhooks</div> }));
vi.mock('../../components/ExplorerAdminPanel', () => ({ default: () => <div>Explorer Admin</div> }));
vi.mock('../../components/ExplorerHubPage', () => ({ default: () => <div>Explorer Hub</div> }));
vi.mock('../../components/StravaConnectInfoBox', () => ({ default: () => <div>Legacy Banner</div> }));
vi.mock('../../components/StravaClubJoinPrompt', () => ({ default: () => <div>Join Prompt</div> }));
vi.mock('../../components/AboutPage', () => ({ default: () => <div>About Page Content</div> }));
vi.mock('../../components/MyProfilePage', () => ({ default: () => <div>Profile</div> }));
vi.mock('../../components/ChatPanel', () => ({ default: () => <div>Chat</div> }));
vi.mock('../../components/ChainChecker', () => ({ default: () => <div>Chain Checker</div> }));

interface RenderResult {
  container: HTMLDivElement;
  root: Root;
}

let renderResult: RenderResult | null = null;

async function renderApp(pathname: string) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[pathname]}>
        <QueryClientProvider client={new QueryClient()}>
          <AppContent />
        </QueryClientProvider>
      </MemoryRouter>
    );
  });

  renderResult = { container, root };
  return renderResult;
}

describe('App auth access shell', () => {
  beforeEach(() => {
    mockAuthStatusUseQuery.mockReset();
    mockSeasonUseQuery.mockReset();

    mockAuthStatusUseQuery.mockReturnValue({
      data: { participant: null, is_admin: false },
      isLoading: false,
      error: null,
    });

    mockSeasonUseQuery.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });
  });

  afterEach(async () => {
    if (renderResult) {
      await act(async () => {
        renderResult?.root.unmount();
      });
      renderResult.container.remove();
      renderResult = null;
    }
  });

  it('renders the WMV join shell instead of leaderboard content for signed-out leaderboard routes', async () => {
    const { container } = await renderApp('/leaderboard');

    expect(container.textContent).toContain('Join Western Mass Velo with Strava');
    expect(container.textContent).toContain('Use Connect with Strava to sign in or reconnect your account');
    expect(container.textContent).toContain('Returning members may see Strava ask them to confirm access again');
    expect(container.textContent).not.toContain('Weekly Leaderboard Content');
    expect(container.textContent).not.toContain('About Page Content');
    expect(container.querySelector('[data-testid="mock-navbar-title"]')?.textContent).toContain('Join WMV');
  });

  it('renders the same WMV join shell for signed-out about routes', async () => {
    const { container } = await renderApp('/about');

    expect(container.textContent).toContain('Join Western Mass Velo with Strava');
    expect(container.textContent).not.toContain('About Page Content');
  });
});