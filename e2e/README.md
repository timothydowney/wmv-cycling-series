# E2E Testing with Playwright

End-to-end tests for UI-specific regressions and responsive design. These tests run **separately** from Jest unit tests.

## Quick Start

**Install dependencies:**
```bash
npm install -D @playwright/test
npx playwright install chromium
```

**Run E2E tests:**
```bash
npm run test:e2e           # Headless
npm run test:e2e:headed    # See browser
npm run test:e2e:debug     # Step-through debugger
npm run test:e2e:ui        # Interactive UI mode
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
3. **Mock authentication state** directly (no OAuth bounce needed)
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
