import { Page } from '@playwright/test';

/**
 * Mock Strava API responses
 * Intercepted by Playwright before reaching our backend
 * Uses TypeScript for type safety with actual API response structures
 */

// Example Strava segment responses (real structure from Strava API)
export const MOCK_STRAVA_SEGMENTS = {
  '2234642': {
    id: 2234642,
    name: 'Box Hill KOM',
    activity_type: 'Ride',
    distance: 2476.8,
    average_grade: 4.7,
    maximum_grade: 16.3,
    elevation_gain: 116.2,
    start_latlng: [51.281, -0.293],
    end_latlng: [51.265, -0.288],
    elevation_low: 52.8,
    elevation_high: 170.0,
    start_location_verify: 1,
    end_location_verify: 1,
    leaderboard_opt_out: false,
    flagged: false,
    hazardous: false,
    created_at: '2015-04-09T18:01:21Z',
    updated_at: '2025-11-01T10:30:00Z',
    total_elevation_gain: 116,
    map: {
      id: 'seg2234642',
      polyline: '...',
      resource_state: 2,
    },
    effort_count: 152000,
    athlete_count: 45000,
    star_count: 8500,
    pr_time: 387,
    efforts_last_batch: '2025-10-28T14:52:54Z',
    segment_efforts: [],
    xoms: {
      kom: {
        athlete_name: 'Tim Downey',
        elapsed_time: 387,
        moving_time: 387,
        start_date: '2025-10-28T14:52:54Z',
        start_date_local: '2025-10-28T06:52:54',
      },
      qom: null,
      overall: {
        rank: 1,
        athlete_name: 'Tim Downey',
        elapsed_time: 387,
        moving_time: 387,
        start_date: '2025-10-28T14:52:54Z',
        start_date_local: '2025-10-28T06:52:54',
      },
    },
    resource_state: 3,
  },
  '12345': {
    id: 12345,
    name: 'Champs-Élysées Sprint',
    activity_type: 'Ride',
    distance: 1200,
    average_grade: 0.5,
    maximum_grade: 2.1,
    elevation_gain: 6.0,
    start_latlng: [48.8702, 2.3122],
    end_latlng: [48.8726, 2.2997],
    elevation_low: 32.5,
    elevation_high: 38.5,
    leaderboard_opt_out: false,
    flagged: false,
    hazardous: false,
    created_at: '2015-03-01T09:00:00Z',
    updated_at: '2025-11-01T10:30:00Z',
    total_elevation_gain: 6,
    map: {
      id: 'seg12345',
      polyline: '...',
      resource_state: 2,
    },
    effort_count: 250000,
    athlete_count: 80000,
    star_count: 15000,
    pr_time: 72,
    efforts_last_batch: '2025-10-28T14:52:54Z',
    segment_efforts: [],
    xoms: {},
    resource_state: 3,
  },
};

// Example Strava athlete responses
export const MOCK_STRAVA_ATHLETES = {
  '70001': {
    id: 70001,
    resource_state: 2,
    firstname: 'Tim',
    lastname: 'Downey',
    city: 'Amherst',
    state: 'MA',
    country: 'USA',
    sex: 'M',
    summit: true,
    created_at: '2015-01-15T10:30:00Z',
    updated_at: '2025-11-01T10:30:00Z',
    badge_type_id: 4,
    profile_medium: 'https://example.com/tim-medium.jpg',
    profile: 'https://example.com/tim-large.jpg',
    friend: null,
    follower: null,
  },
  '70002': {
    id: 70002,
    resource_state: 2,
    firstname: 'Chris',
    lastname: 'Smith',
    city: 'Boston',
    state: 'MA',
    country: 'USA',
    sex: 'M',
    summit: false,
    created_at: '2015-02-20T08:15:00Z',
    updated_at: '2025-11-01T10:30:00Z',
    badge_type_id: 1,
    profile_medium: 'https://example.com/chris-medium.jpg',
    profile: 'https://example.com/chris-large.jpg',
    friend: null,
    follower: null,
  },
};

/**
 * Setup Strava API interception for tests
 * Intercepts HTTP calls to api.strava.com and returns mock data
 *
 * Usage:
 *   test('segment displays metadata', async ({ page }) => {
 *     await setupStravaInterception(page);
 *     await page.goto('/leaderboard/1/weekly/1');
 *     // Strava API calls are now mocked
 *   });
 */
export async function setupStravaInterception(page: Page) {
  // Mock Strava segment API calls
  await page.route('**/api.strava.com/api/v3/segments/**', async route => {
    const url = new URL(route.request().url());
    const segmentId = url.pathname.split('/').pop();
    const mockData =
      MOCK_STRAVA_SEGMENTS[segmentId as keyof typeof MOCK_STRAVA_SEGMENTS];

    if (mockData) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockData),
      });
    } else {
      // Unknown segment
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Segment not found' }),
      });
    }
  });

  // Mock Strava athlete profile API calls
  await page.route('**/api.strava.com/api/v3/athletes/**', async route => {
    const url = new URL(route.request().url());
    const athleteId = url.pathname.split('/').pop();

    // Check if it's specifically the authenticated athlete endpoint
    if (url.pathname.endsWith('/athletes/me') || athleteId === 'me') {
      // Default to first test athlete
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_STRAVA_ATHLETES['70001']),
      });
    } else {
      const mockData =
        MOCK_STRAVA_ATHLETES[athleteId as keyof typeof MOCK_STRAVA_ATHLETES];

      if (mockData) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockData),
        });
      } else {
        // Unknown athlete
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Athlete not found' }),
        });
      }
    }
  });
}

/**
 * Set authenticated session by setting a mock session cookie
 *
 * Usage:
 *   await setAuthCookie(page, '70001'); // Log in as Tim Downey
 *
 * Note: This bypasses the need for actual Strava OAuth in tests
 */
export async function setAuthCookie(
  page: Page,
  athleteId: string,
  options?: {
    name?: string;
    sameSite?: 'Strict' | 'Lax' | 'None';
  }
) {
  const cookieName = options?.name ?? 'wmv.sid';
  const sameSite = options?.sameSite ?? 'Lax';

  // Generate a simple test session token
  // In real tests, you'd use actual session tokens from your session store
  const sessionToken = `test-session-${athleteId}-${Date.now()}`;

  await page.context().addCookies([
    {
      name: cookieName,
      value: sessionToken,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: sameSite as 'Strict' | 'Lax' | 'None',
      expires: Date.now() / 1000 + 86400, // 24 hours from now
    },
  ]);
  
  // Note: localStorage not used here - can cause security errors in Playwright
  // Rely on session cookie for auth instead
}

/**
 * Navigate to a specific week's leaderboard
 */
export async function navigateToWeek(
  page: Page,
  seasonId: number,
  weekId: number
) {
  await page.goto(`/leaderboard/${seasonId}/weekly/${weekId}`);
  await waitForLeaderboardLoad(page);
}

/**
 * Navigate to season leaderboard
 */
export async function navigateToSeason(page: Page, seasonId: number) {
  await page.goto(`/leaderboard/${seasonId}/season`);
  await waitForLeaderboardLoad(page);
}

/**
 * Wait for leaderboard data to load
 * Checks for presence of leaderboard cards (indicates tRPC data fetched)
 */
export async function waitForLeaderboardLoad(page: Page) {
  // Wait for at least one leaderboard card to be present (using data-testid standard)
  await page.locator('[data-testid^="leaderboard-card-"]').first().waitFor({ timeout: 5000 });
}

/**
 * Get all leaderboard card text content
 * Useful for verifying card data in tests
 */
export async function getLeaderboardCardTexts(page: Page): Promise<string[]> {
  // Get all cards using data-testid selector (standard pattern)
  const cards = await page.locator('[data-testid^="leaderboard-card-"]').all();
  const texts: string[] = [];

  for (const card of cards) {
    const text = await card.textContent();
    if (text) {
      texts.push(text.trim());
    }
  }

  return texts;
}

/**
 * Verify that a leaderboard card doesn't have overflow/clipping issues
 * Checks that participant name fits within its container
 */
export async function verifyCardTextFits(
  page: Page,
  cardIndex: number = 0
): Promise<{ fits: boolean; containerWidth: number; textWidth: number }> {
  // Use data-testid selector (standard pattern) instead of CSS class
  const card = page.locator('[data-testid^="leaderboard-card-"]').nth(cardIndex);
  const nameElement = card.locator('.card-name'); // Internal card structure

  const nameBox = await nameElement.boundingBox();
  const cardBox = await card.boundingBox();

  if (!nameBox || !cardBox) {
    throw new Error('Could not get bounding box for card or name');
  }

  // Text fits if it doesn't extend past card boundaries (with 10px padding)
  const fits = nameBox.x + nameBox.width <= cardBox.x + cardBox.width - 10;

  return {
    fits,
    containerWidth: cardBox.width,
    textWidth: nameBox.width,
  };
}
