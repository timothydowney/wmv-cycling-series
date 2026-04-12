# E2E Testing with Authentication

This directory contains end-to-end tests for the WMV Cycling Series application.

## Test Projects

### 1. Logged-Out Tests (Default)
All tests except `*.authenticated.spec.ts` files run without authentication:
- `smoke.spec.ts` - Setup verification
- `weekly-header.spec.ts` - Weekly leaderboard header
- `leaderboard-card.spec.ts` - Athlete result cards
- `season-leaderboard.spec.ts` - Season leaderboard
- `logged-out.spec.ts` - Banner for non-authenticated users
- `unit-toggle.spec.ts` - Unit preference toggle

### 2. Logged-In Tests (Authenticated)
Tests matching `*.authenticated.spec.ts` create a real app session through the e2e auth helper:
- `authenticated.spec.ts` - Features requiring login

## Authentication Setup

### First Time Setup

Before running Playwright locally on Linux or WSL, install both the browser binary and the OS packages Chromium needs:

```bash
npx playwright install chromium
npx playwright install-deps chromium
```

Authenticated tests now work out of the box in the e2e environment by calling a test-only backend helper that sets the session for the configured test athlete.

Manual Strava authentication is still available if you want to refresh a real browser state for exploratory testing:

```bash
npm run test:e2e:auth
```

### Running Tests

```bash
# Run all tests (logged-out + logged-in)
npm run test:e2e

# Run only logged-out tests
npx playwright test --project=logged-out

# Run only authenticated tests
npx playwright test --project=logged-in

# Re-authenticate when session expires
npm run test:e2e:auth
```

Normal CI-style and local regression runs do not require `e2e/.auth/user.json` or a manual Strava login.

## Session Management

### When to Re-authenticate Manually

Run `npm run test:e2e:auth` only if you want an exploratory browser session backed by real Strava OAuth.

### Automated Test Auth

The normal Playwright suite no longer depends on `e2e/.auth/user.json`. Authenticated specs create their own server session through a test-only helper route that is available in local development and can also be explicitly enabled with `ENABLE_E2E_TEST_AUTH=true`.

If Playwright fails before tests start with shared library errors such as `libnspr4.so` missing, the issue is machine setup, not expired auth state.

## Writing Tests

### Logged-Out Tests
Create normal test files (they run by default):
```typescript
// e2e/tests/my-feature.spec.ts
import { test, expect } from '@playwright/test';

test('my feature works', async ({ page }) => {
  // Test runs without authentication
});
```

### Authenticated Tests
Name files with `*.authenticated.spec.ts`:
```typescript
// e2e/tests/admin-panel.authenticated.spec.ts
import { test, expect } from '@playwright/test';

test('admin can create weeks', async ({ page }) => {
  // Test runs with saved authentication
  // User is already logged in
});
```

## Troubleshooting

### Authenticated tests fail with "not logged in"
- Confirm the backend is running locally in development mode
- If you are using a custom environment, set `ENABLE_E2E_TEST_AUTH=true`

### Tests hang during authentication
- Check that dev servers are running (frontend on :5173, backend on :3001)
- Verify your Strava credentials are correct
- Check that OAuth redirect URL is configured in Strava app settings

## Files

- `e2e/.auth/` - Stores authentication state (gitignored)
- `e2e/auth.setup.ts` - Authentication setup test
- `e2e/tests/*.spec.ts` - Logged-out tests
- `e2e/tests/*.authenticated.spec.ts` - Logged-in tests
