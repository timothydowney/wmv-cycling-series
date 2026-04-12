# E2E Testing with Playwright

End-to-end tests for UI-specific regressions and responsive design. These tests run **separately** from Jest unit tests.

## Quick Start

**Install dependencies:**
```bash
npm install -D @playwright/test
npx playwright install chromium
npx playwright install-deps chromium
```

**Run E2E tests:**
```bash
npm run test:e2e           # Headless
npm run test:e2e:headed    # See browser
npm run test:e2e:ui        # Interactive UI mode
npm run test:e2e:auth      # Manual real Strava OAuth for exploratory browser state
```

**View test report:**
```bash
npm run test:e2e:report
```

## Test Categories

- **`segment-display.spec.ts`** - Segment metadata rendering (elevation, grade, category)
- **`jersey-awards.spec.ts`** - Jersey icon display (polka dot, yellow, lanterne rouge)
- **`leaderboard.spec.ts`** - Leaderboard card rendering and data display
- **`navigation.spec.ts`** - Week/season selection and navigation flows
- **`responsive.spec.ts`** - Mobile/tablet/desktop layout adaptation

## Key Principles

1. **Mock Strava API calls** at the network level (Playwright route interception)
2. **Test against isolated database copy** (extracted from dev:prod, prevents interference)
3. **Use the backend e2e auth helper** for normal authenticated specs (no OAuth bounce needed)
4. **Sequential execution** in Phase 1 (enable parallelization in Phase 2)
5. **TypeScript fixtures** for type safety with tRPC types

## Phase 1 Status: Setup

- [ ] Install Playwright
- [ ] Create `playwright.config.ts`
- [ ] Create `fixtures/strava-mocks.ts` (TypeScript)
- [ ] Create `fixtures/test-helpers.ts`
- [ ] Write first smoke test
- [ ] Add npm scripts

See [docs/PLAYWRIGHT_TESTING_PLAN.md](../docs/PLAYWRIGHT_TESTING_PLAN.md) for complete strategy.

## Authentication Notes

- Normal Playwright regression runs do not require a saved browser auth file.
- Logged-in specs create a session through `POST /auth/e2e-login` via `loginAsE2EUser()`.
- Run `npm run test:e2e:auth` only when you intentionally want a manual, real Strava OAuth browser session for exploration.
- On Linux or WSL, missing shared libraries such as `libnspr4.so` mean you need `npx playwright install-deps chromium`, not a new auth session.
