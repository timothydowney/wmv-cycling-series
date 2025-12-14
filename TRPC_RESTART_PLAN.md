# tRPC & Drizzle Modernization Plan (Revised) (✅ Complete)

**Objective:** Migrate the application to an end-to-end type-safe architecture using **tRPC** (for API) and **Drizzle ORM** (for Database), eliminating manual types and raw SQL strings.

## 🛑 Core Mandates (Ground Rules)

1.  **Production Safety is Paramount:**
    *   The database is live. **NEVER** alter existing column names or remove columns via migration unless explicitly planned.
    *   **Migration Strategy (Phases 1-7):** Retain the existing "Flyway-style" SQL migration system (`server/src/migrations.ts`). Use Drizzle in **Introspection Mode** to generate types from the live DB.
    *   **Migration Strategy (Phase 8):** Transition fully to Drizzle Migrations (`drizzle-kit migrate`) only after the codebase is stable.

2.  **Single Source of Truth (The ORM):**
    *   The Drizzle Schema (`server/src/db/schema.ts`) is the **only** place types are defined.
    *   **NO** manual interfaces (e.g., `interface SeasonRow`). Types are inferred: `type Season = typeof seasons.$inferSelect`.
    *   The Frontend imports these inferred types.

3.  **Naming Conventions (Strava Alignment):**
    *   Respect the database/Strava field names (e.g., `strava_segment_id`).
    *   Do not create frontend aliases (like `segment_id`) that require translation layers. Update the frontend components to match the backend.

4.  **Iterative "Vertical Slice" Migration:**
    *   Migrate one domain at a time.
    *   A slice is complete when: Backend Router + Drizzle Query + Frontend Component + Tests are all updated and passing.

## 🛠️ Technical Strategy & Order of Operations

### Phase 1: Foundation & Type Plumbing (✅ Complete)
*   **Goal:** Establish the "Single Source of Truth" for types.
*   **Tasks:**
    1.  **Repo Config:** Fix `tsconfig.json` (root and server) to allow clean imports of server types into the frontend (solve the "Cannot find module" error once and for all).
    2.  **Drizzle Setup:**
        *   Install `drizzle-orm` and `drizzle-kit`.
        *   Run `drizzle-kit introspect` against the local `wmv.db` to generate the initial `schema.ts`.
        *   **Verify:** Ensure `schema.ts` accurately reflects the current DB structure.
        *   Export inferred types from this schema (e.g., `export type Season = ...`).
    3.  **tRPC Setup:**
        *   Install tRPC dependencies.
        *   Create the `trpc` client and `QueryClientProvider` in `App.tsx`.

### Phase 2: Vertical Slice - "Seasons" (✅ Complete)
*   **Goal:** Prove the full stack (DB -> ORM -> tRPC -> Frontend).
*   **Backend:**
    *   Rewrite `SeasonService` to use Drizzle queries (e.g., `db.select().from(seasons)...`).
    *   Create `seasonRouter` exposing these methods.
    *   **Test:** Update `seasonRouter.test.ts` to use the new Drizzle-based service.
*   **Frontend:**
    *   Migrate `SeasonManager.tsx` to use `trpc.season...`.
    *   Replace manual `interface Season` with the import from Drizzle schema.

### Phase 3: Vertical Slice - "Weeks" (✅ Complete Backend)
*   **Goal:** Handle foreign keys and joins.
*   **Backend:**
    *   Rewrite `WeekService` using Drizzle (handling the join with Segments).
    *   Create `weekRouter`.
    *   **Test:** Created `weekRouter.test.ts` covering CRUD and Joins.
    *   **Refactor:** Updated `testDataHelpers.ts` to use Drizzle and ES Modules.
*   **Frontend:**
    *   Migrate `WeekManager.tsx`, `ScheduleTable.tsx`, and `SeasonWeekSelectors.tsx`.
    *   **Refactor:** Rename props in these components to match the DB (e.g., `segment_id` -> `strava_segment_id`) to remove translation layers.

### Phase 4: Vertical Slice - "Segments" (✅ Complete Backend)
*   **Goal:** Manage the Segment resource.
*   **Backend:**
    *   Rewrite `SegmentService` with Drizzle.
    *   Create `segmentRouter` (procedures: `getAll`, `create` (admin), `validate`).
    *   **Refactor:** Fixed legacy route instantiations to use Drizzle DB.
*   **Frontend:**
    *   Migrate `ManageSegments.tsx`.

### Phase 5: Vertical Slice - "Participants" (✅ Complete)

### Phase 6: "Leaderboards" (✅ Complete)

### Phase 7: Cleanup (✅ Complete)

### Phase 8: Adopt Drizzle Migrations (✅ Complete)
*   **Goal:** Replace legacy migration script with `drizzle-kit`.
*   **Tasks:**
    1.  Generate a "baseline" migration from the current `schema.ts`.
    2.  Apply this baseline to the production database using the "fake" or "resolve" flag (telling Drizzle "this is already applied").
    3.  Deprecate/Remove `server/src/migrations.ts`.
    4.  Update `package.json` to use `drizzle-kit migrate` for future updates.

## 🧹 Tech Debt & Known Issues (To Be Addressed in Phase 7 or earlier)
1.  **Strict Types for Joins:** `WeekService.getAllWeeks` returns a joined object (Week + Segment fields) that doesn't perfectly match the Drizzle inferred `Week` type. Currently cast as `any` then `Week[]`. Need to define a `WeekWithSegment` type for stricter safety. (✅ Complete)
2.  **Test Helper Typing:** `server/src/__tests__/testDataHelpers.ts` has `// @ts-nocheck`. It needs proper TypeScript types for the `db` parameter and return values. (✅ Complete)
3.  **Leaderboard Logic:** `getWeekLeaderboard` is complex. Ensure it has comprehensive unit tests covering edge cases (ties, no data) when we get to Phase 6. (✅ Complete)
4.  **Frontend Aliases:** Ensure frontend components stop using `segmentId` and use `stravaSegmentId` natively to match the backend updates. (✅ Complete)