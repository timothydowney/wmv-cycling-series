import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnitProvider } from '../../context/UnitContext';
import NavBar from '../NavBar';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('../../api', () => ({
  disconnect: vi.fn(async () => ({ success: true, message: 'ok' })),
  getConnectUrl: vi.fn(() => '/auth/strava'),
}));

interface RenderResult {
  container: HTMLDivElement;
  root: Root;
}

let renderResult: RenderResult | null = null;

async function renderNavBar(overrides: Partial<React.ComponentProps<typeof NavBar>> = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/leaderboard']}>
        <UnitProvider>
          <NavBar
            title="Weekly Leaderboard"
            isAdmin
            isConnected
            athleteInfo={{ firstname: 'Tim', lastname: 'Downey', profile: undefined }}
            userAthleteId="366880"
            {...overrides}
          />
        </UnitProvider>
      </MemoryRouter>
    );
  });

  renderResult = { container, root };
  return renderResult;
}

async function openMenu(container: HTMLElement) {
  const button = container.querySelector('button[aria-label="Menu"]');

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error('Expected profile menu button');
  }

  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('NavBar Explorer admin link', () => {
  beforeEach(() => {
    localStorage.clear();
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

  it('shows Manage Explorer in the admin menu for admins', async () => {
    const { container } = await renderNavBar();

    await openMenu(container);

    const explorerLink = container.querySelector('a[href="/explorer-admin"]');
    expect(explorerLink?.textContent).toContain('Manage Explorer');
  });

  it('hides Manage Explorer for non-admin users', async () => {
    const { container } = await renderNavBar({ isAdmin: false });

    await openMenu(container);

    expect(container.querySelector('a[href="/explorer-admin"]')).toBeNull();
  });
});