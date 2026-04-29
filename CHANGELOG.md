# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Note**: This changelog was started at v0.9.0. For details on earlier versions (0.1.0 - 0.8.x),
> please refer to the [git commit history](https://github.com/tim-downey/strava-ncc-scrape/commits/main).

## [Unreleased]

### Added
- Drizzle migration lifecycle for Postgres: a Postgres baseline migration (`server/drizzle/0000_postgres_baseline.sql`) is now the single source of truth for schema creation. New schema changes are generated with `npm run db:generate` and applied with `npm run db:migrate` (or automatically at server startup).
- `db:generate` and `db:migrate` npm scripts added to both root and `server/package.json` for forward migrations.
- `server/drizzle.config.ts` updated to Postgres-only dialect; SQLite conditional removed.
- Post-cutover schema change workflow documented in `docs/POSTGRES_MIGRATION_RUNBOOK.md`.
- Old SQLite-era migration files archived to `server/drizzle/_sqlite_history/` to keep the active migration directory clean.

### Changed
- Removed legacy SQLite-style query compatibility shim (`wrapQueryBuilder`, `wrapOrmWithLegacyCompat`) from the test helper `setupTestDb`. All test queries now use idiomatic async Postgres-style Drizzle calls (`.execute()`) directly.

### Fixed
- Remaining operational timestamp columns (`activity.validated_at`, `segment.metadata_updated_at`, `webhook_subscription.last_refreshed_at`, `deletion_request.requested_at`/`completed_at`, `schema_migrations.executed_at`, `participant.weight_updated_at`) migrated from `text` to `timestamptz` in Postgres via migration `0017`. Drizzle schema, bootstrap script, and test DDL updated to match.
- `chain_wax_period.created_at`, `chain_wax_activity.created_at`, and `chain_wax_puck.created_at` migrated from `bigint` Unix seconds to `timestamptz` in Postgres via migration `0018` using `to_timestamp()`. Service code updated to use DB defaults; bootstrap script, test DDL, and all chain-wax tests updated accordingly.

### Added
- Local-first Postgres migration tooling, including schema bootstrap, SQLite-to-Postgres import, row-count parity verification, rollback-tag verification, local Docker Postgres compose, and Railway rehearsal import/environment setup scripts.

### Changed
- Backend runtime and data-access layers now run Postgres-first with async Drizzle query patterns across services, routers, webhook processing, auth/session persistence, and test infrastructure.
- Development and E2E startup workflows now auto-ensure local Postgres readiness, explicit target database creation, and optional fixture/bootstrap import flows for deterministic test runs.

### Removed
- Legacy SQLite-specific runtime paths and storage-monitor surfaces that are no longer used in the Postgres-first branch.

### Changed
- Webhook admin event history now uses a cleaner leaderboard-inspired card layout with clearer title hierarchy, collapsed match badges for competition and Explorer outcomes, and simpler expanded activity detail cards.

### Fixed
- Webhook admin activity rows once again opportunistically fetch Strava activity detail for list and expanded views, cache those lookups briefly, and classify private or unavailable activities more clearly during local prod-data review.

### Added
- Explorer now lets athletes pin destinations from the Destinations tab and surfaces pinned remaining destinations first on the Hub page.
- A standalone Manage Roles admin screen for granting and revoking database-backed admin access for participants who have logged in.
- Explorer admin now lets admins remove campaign destinations directly from the campaign workflow with a simple confirmation step.
- Explorer admin now surfaces shared Strava segment detail fields including elevation, climb category, coordinates, and metadata refresh time inside expanded destination cards.

### Changed
- Signed-out visitors now see a branded WMV join shell instead of leaderboard or About routes, and the page clarifies that "Connect with Strava" is also how returning members reconnect.
- Explorer destination cards now use consistent icon-based completion and flagged status cues across the Hub and Destinations views.
- Explorer's athlete-facing Destinations tab now supports local destination search and completion filters using the existing campaign progress data, making larger campaign checklists easier to browse without adding a new backend contract.
- Season openness is now treated as date-based in application logic, allowing overlapping seasons to remain open concurrently.
- Admin authorization now evaluates database-backed admin roles in addition to the `ADMIN_ATHLETE_IDS` env var, which remains the break-glass fallback.
- The navigation now exposes Manage Roles as its own first-class admin destination and keeps About clearly outside the admin menu grouping.
- Explorer admin now centers the current or next campaign as the primary workspace, keeps campaign editing inline at the top of the expanded card, and demotes create-campaign planning until it is needed.
- Shared segment metadata persistence now captures Strava start and end coordinates plus a freshness timestamp for reuse across Explorer and competition flows.
- Explorer admin destination metadata now respects the app-wide imperial or metric unit preference instead of always rendering metric values.
- Upgraded the frontend runtime and type packages to React 19 (`react`, `react-dom`, `@types/react`, and `@types/react-dom`) as the first major-version migration PR in the dependency modernization set.
- Upgraded the next safe batch of major dependencies in one pass: Vite 8 + `@vitejs/plugin-react` 6, TypeScript 6 (frontend and backend), Express 5, `strava-v3` 4, and `@types/express` 5.
- Clarified the Playwright e2e prerequisites and authentication flow in the e2e docs: normal logged-in tests use the backend e2e session helper, while manual Strava OAuth is now documented as optional exploratory setup.
- Refactored webhook activity ingestion into a shared context plus distinct chain wax and competition handler modules, keeping execution order explicit and Phase 1 Explorer groundwork easier to extend.
- Updated the Explorer PRD implementation docs to reflect the Phase 1 handler order, shared context contract, and the decision to keep delete and athlete deauthorization adjacent to the processor for now.

### Fixed
- Core SQLite tables created from the early migration chain now repair broken timestamp defaults to real database timestamps, covering non-Explorer inserts and existing legacy rows.
- Explorer destination add timestamps now store real database timestamps instead of a literal default-expression string, and existing broken local rows are repaired through migration.
- Explorer admin no longer falls back to "Not recorded" for newly added destinations when the database has a valid add timestamp.
- Made mobile navbar dropdown overflow protection verifiable with concrete E2E assertions (viewport-fit, scrollability, and reachable menu items), preventing false-positive test passes.
- Repaired the real Strava integration after the `strava-v3` v4 upgrade by constructing authenticated client instances with `new strava.client(...)`, which restores WMV club membership checks and webhook activity enrichment in development.
- Corrected the webhook admin event-history time filter to send an absolute Unix timestamp to the backend, so the selected 24-hour, 7-day, and 30-day windows now query the intended event range.
- Stabilized webhook event-history filtering by keeping the computed `since` timestamp fixed until the selected time range changes, preventing redundant refetches in the admin page.
- Restored WMV club membership detection after the `strava-v3` v4 upgrade by using the supported `athlete.get()` API path and falling back to `athlete.listClubs()` when club data is omitted from the athlete payload.
- Restored WMV club membership detection when Strava returns an empty `clubs` array from `athlete.get()` by treating that response the same as a missing clubs payload and falling back to `athlete.listClubs()`.
- Creating or editing one season no longer closes another season through the legacy `season.is_active` path.
- Batch fetch and webhook season validation no longer rely on the removed manual-active flag.
- Refreshed frontend and backend npm dependencies to pick up current patch/minor fixes and reduce known audit issues in the dependency graph.
- Aligned dependency baselines to the latest stable releases that fit the current React 18, Express 4, and Node 24 stack, including updated backend type packages.
- Restored Railway-compatible Docker builds after the Node version guards were added by copying those guard files into the image before `npm ci`, and added an explicit local Docker validation command for future dependency/build changes.
- Updated Strava client typing adapters for `strava-v3` v4 and resolved a CSS syntax issue surfaced by Vite 8's stricter CSS minifier so production builds stay green.
- Added explicit competition-handler regression coverage for week storage and kept chain wax create-delete regression coverage aligned with the new delegated webhook structure.

### Removed
- Removed the legacy `season.is_active` database column now that season openness is fully date-based.

## [0.13.0] - 2026-03-15

### Added
- **Chain Checker**: Admin-only chain wax tracking page for the shared Tacx Neo 2T trainer.
  - Tracks combined Zwift virtual ride distance for Tim and Will against an 800km re-wax interval.
  - Progress bar with color zones: green (< 75%), yellow (75-90%), red (>= 90%).
  - "Wax Your Chain" button with date/time picker to record wax events and reset the counter.
  - Wax puck lifespan tracker (8 uses per puck) with visual dots display.
  - Resync button to pull latest activities from Strava API.
  - Wax history table showing past wax periods with distance and duration.
  - Automatic tracking via existing Strava webhooks (VirtualRide activity type).
  - Deduplication via unique activity ID constraint prevents double-counting.
  - Respects the existing km/miles unit toggle.

## [0.12.1] - 2026-02-17

### Added
- **AI Chat architecture documentation** (`docs/AI_CHAT.md`): Comprehensive doc covering tool inventory, service reuse audit, design decisions, and actionable TODOs including feedback collection, response enrichment, and broader rollout.

### Removed
- Removed `docs/AI_CHAT_PLAN.md` — superseded by the new architecture doc.

## [0.12.0] - 2026-02-15

### Added
- **AI Chat Assistant**: Ask questions about competition data in natural language. Available to admins from the navigation menu.
  - Compare athletes, check standings, analyze performance trends, and review season history.
  - Automatic nickname resolution ("Mike" finds "Michael Bello").
  - Smart context awareness (knows current season and logged-in user).
  - Structured analysis with season overviews, head-to-head matchups, and performance insights.
  - Rate limiting (10 messages/minute, 200/day) to manage API costs.
  
### Fixed
- **Chat responses complete quickly** without timeouts (typically 3-12 seconds).
- **Markdown tables render properly** in chat responses.
- **Optimized database queries** to avoid unnecessary Strava API calls during chat operations.

## [0.11.1] - 2026-02-04

### Changed
- **Responsive Header Improvements**: Enhanced mobile appearance by increasing WMV logo size to 40px (matching profile photo logo) across all screen sizes.
- **Larger Navigation Title**: Increased navbar title font size by 20-30% on mobile breakpoints for better readability.
- **Header Standardization**: Standardized 40px height for primary navigation elements and adjusted navbar height on small screens.

## [0.11.0] - 2026-02-03

### Added
- **Race Day Motivation Banner**: Interactive banner on Weekly Leaderboards that appears for logged-in participants on active race days if they haven't yet posted a result.
- Animated checkerboard flag graphics and competitive messaging to encourage participation.
- Clean component-based architecture for the new motivational banner.

## [0.10.0] - 2026-02-02

### Added
- **Profile Page Redesign**: Comprehensive Career Highlights grid displaying lifetime best rankings, peak power output, PRs, and win streaks.
- **Season Stats Cards**: New full-width season cards with horizontal layout for Current Season and Palmarès sections. Displays total points, weeks participated, best TT/HC weekly rankings, and win counts.
- **Season Champion Badges**: Prominent display of overall season wins and hill climb victories with large circular badge styling.
- Responsive grid improvements for Career Highlights (4 columns on desktop, 3 on tablet, 2 on mobile).

### Changed
- Profile header now centered with cleaner, less cluttered appearance.
- Consolidated all season stats under unified visual style matching Career Highlights aesthetic.
- Removed status indicators and moved participation totals into main stats grid.

## [0.9.0] - 2026-02-02

### Added
- **Watts per Kilogram (w/kg) Metric**: Display power-to-weight ratio on leaderboard cards. Captured from Strava API during activity ingestion. Only displays when both watts and weight data are available. Unit-agnostic (always shown in w/kg regardless of imperial/metric preference).

[Unreleased]: https://github.com/tim-downey/strava-ncc-scrape/compare/v0.12.1...HEAD
[0.12.1]: https://github.com/tim-downey/strava-ncc-scrape/compare/v0.12.0...v0.12.1
[0.12.0]: https://github.com/tim-downey/strava-ncc-scrape/compare/v0.11.1...v0.12.0
[0.11.1]: https://github.com/tim-downey/strava-ncc-scrape/compare/v0.11.0...v0.11.1
[0.11.0]: https://github.com/tim-downey/strava-ncc-scrape/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/tim-downey/strava-ncc-scrape/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/tim-downey/strava-ncc-scrape/releases/tag/v0.9.0
