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
Tests matching `*.authenticated.spec.ts` run with saved authentication:
- `authenticated.spec.ts` - Features requiring login

## Authentication Setup

### First Time Setup

1. **Authenticate with Strava** (one-time):
   ```bash
   npm run test:e2e:auth
   ```

2. **Follow the prompts**:
   - Browser will open to the app
   - Click "Connect with Strava"
   - Log in to Strava
   - Authorize the application
   - Wait for redirect back to app

3. **Session saved**:
   - Authentication state saved to `e2e/.auth/user.json`
   - This file is gitignored (contains your session tokens)
   - Session will be reused for all authenticated tests

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

## Session Management

### When to Re-authenticate

Run `npm run test:e2e:auth` if:
- Session expires (your app should auto-refresh, but may eventually expire)
- Authenticated tests start failing with "not logged in" errors
- You cleared the `e2e/.auth/user.json` file

### Session Auto-Refresh

Your application automatically refreshes OAuth tokens, so saved sessions should remain valid for extended periods. If tests fail due to expired sessions, simply re-run the auth setup.

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

### "storageState: path does not exist"
- Run `npm run test:e2e:auth` to create the session file

### Authenticated tests fail with "not logged in"
- Session expired, re-run `npm run test:e2e:auth`

### Tests hang during authentication
- Check that dev servers are running (frontend on :5173, backend on :3001)
- Verify your Strava credentials are correct
- Check that OAuth redirect URL is configured in Strava app settings

## Files

- `e2e/.auth/` - Stores authentication state (gitignored)
- `e2e/auth.setup.ts` - Authentication setup test
- `e2e/tests/*.spec.ts` - Logged-out tests
- `e2e/tests/*.authenticated.spec.ts` - Logged-in tests
