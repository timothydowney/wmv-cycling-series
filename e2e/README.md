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
2. **Keep E2E wiring explicit** through a dedicated Playwright env and backend E2E mode
3. **Use the backend e2e auth helper** for normal authenticated specs (no OAuth bounce needed)
4. **Handle outbound backend dependencies explicitly** rather than assuming browser interception can cover them
5. **Sequential execution** in Phase 1 (enable parallelization in Phase 2)
6. **TypeScript fixtures** for type safety with tRPC types

## Harness Rules (Target / Next)

These principles describe the intended direction for the E2E harness as it becomes stricter and more explicit.

- Keep test-harness checks centralized in config, bootstrapping, and scripts.
- Do not scatter test-mode checks through feature logic.
- Use one backend E2E mode for test-only wiring such as auth helpers, environment validation, and safe defaults.
- Use explicit provider selection for outbound integrations when behavior must differ in E2E, for example live, fixture-backed, or mock-server-backed Strava behavior.
- Fail fast if the intended E2E env file or backend mode is missing instead of silently falling back to the normal development environment.

Current reality: Playwright now boots dedicated frontend and backend E2E servers for `npm run test:e2e`, the backend uses an explicit E2E runtime mode for harness boot concerns, and deterministic backend Strava behavior is selected through explicit providers for the current Explorer and read-side flows. The E2E database resets from the committed sanitized fixture at `server/data/wmv_e2e_fixture.db`, so the suite no longer depends on a contributor's local `wmv.db` to run on a fresh clone.

This matters for Explorer admin flows because destination authoring fetches segment metadata from the backend, so Playwright browser interception alone is not sufficient for repeatable coverage and is one reason the stricter harness direction is needed.

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

## Existing Test Impact

- Existing UI-focused Playwright tests can keep using browser-side Strava route interception for client-rendered metadata and display checks.
- Existing authenticated tests can keep using the backend e2e-login helper.
- The main change for new Explorer admin E2E coverage is that server-side Strava-dependent behavior must run through an explicit backend provider mode rather than relying on browser interception.
- Existing tests should not need a broad rewrite, but the harness should become stricter about env setup and fixture data so it cannot silently run against unintended local state.
