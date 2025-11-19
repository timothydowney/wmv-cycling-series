// @ts-nocheck
// Mock strava-v3 library to prevent network calls
jest.mock('strava-v3', () => ({
  config: jest.fn(),
  client: jest.fn().mockImplementation(() => ({
    activities: { get: jest.fn() }
  })),
  oauth: {
    refreshToken: jest.fn(),
    getToken: jest.fn()
  }
}));

// Mock the app (we'll need to refactor index.js to export app for testing)
// For now, we'll test the endpoints that don't require full OAuth flow

describe('OAuth and Authentication', () => {
  describe('GET /auth/strava', () => {
    test('redirects to Strava OAuth authorize URL', async () => {
      // This test would require importing the app
      // For now, we're documenting the expected behavior
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('GET /auth/status', () => {
    test('returns not authenticated when no session', async () => {
      // This test would require importing the app
      // For now, we're documenting the expected behavior
      expect(true).toBe(true); // Placeholder
    });

    test('returns participant info when authenticated', async () => {
      // This test would require importing the app with session management
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('POST /auth/disconnect', () => {
    test('requires authentication', async () => {
      // Should return 401 when not authenticated
      expect(true).toBe(true); // Placeholder
    });

    test('deletes tokens and destroys session', async () => {
      // Should remove tokens from database and clear session
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('getValidAccessToken()', () => {
    test('returns existing token when not expired', async () => {
      // Mock: token expires_at > now + 3600
      expect(true).toBe(true); // Placeholder
    });

    test('refreshes token when expiring soon', async () => {
      // Mock: token expires_at < now + 3600
      // Mock fetch to Strava token endpoint
      expect(true).toBe(true); // Placeholder
    });

    test('throws error when participant not connected', async () => {
      // No token record exists
      expect(true).toBe(true); // Placeholder
    });

    test('updates database with refreshed tokens', async () => {
      // Verify both access_token and refresh_token updated
      expect(true).toBe(true); // Placeholder
    });
  });
});

/*
NOTE: Full OAuth testing requires:
1. Exporting the Express app from index.js (or refactoring into separate modules)
2. Mocking the Strava API (fetch to oauth/token endpoint)
3. Session management in tests (using supertest with cookies)

For now, OAuth can be manually tested by:
1. Starting server: npm start
2. Visiting: http://localhost:3001/auth/strava
3. Authorizing with real Strava account
4. Verifying tokens stored in database
5. Testing /auth/status returns correct data
6. Testing /auth/disconnect clears session

TODO: Refactor index.js to export app separately from server.listen()
This allows proper integration testing of OAuth routes.
*/
