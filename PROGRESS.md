# tRPC Migration Progress

**Branch:** `feature/trpc-migration`
**Date:** 2025-11-28

## Overview
We have initiated **Phase 1** of the [Architecture Modernization Plan](docs/ARCHITECTURE_MODERNIZATION_PLAN.md). The goal is to introduce end-to-end type safety between the backend and frontend using **tRPC**, eliminating manual API clients and duplicate type definitions.

## Accomplishments

### 1. Infrastructure Setup
-   **Dependencies:** Installed `@trpc/server`, `@trpc/client`, `@trpc/react-query`, `@tanstack/react-query`, and `zod`.
-   **Backend Config:**
    -   Created `server/src/trpc/context.ts` to handle request context (Express request, session, database).
    -   Created `server/src/trpc/init.ts` to initialize the tRPC router and procedures (including an `adminProcedure` middleware).
    -   Integrated tRPC middleware into `server/src/index.ts`.
-   **Frontend Config:**
    -   Wrapped `src/App.tsx` with `QueryClientProvider` and `trpc.Provider`.
    -   Created the typed tRPC hook in `src/utils/trpc.ts`.

### 2. Database Refactoring
-   **Fix:** Resolved a circular dependency that caused a startup crash.
-   **Action:** Moved database initialization from `server/src/index.ts` to a dedicated module `server/src/db.ts`.
-   **Impact:** `index.ts`, routers, and context now import the singleton `db` instance from `server/src/db.ts`.

### 3. Vertical Slice Migration: "Seasons"
We have fully migrated the **Season Management** feature to prove the concept.

-   **Backend Router:** Created `server/src/routers/season.ts` with the following procedures:
    -   `getAll` (public query)
    -   `getById` (public query)
    -   `create` (admin mutation)
    -   `update` (admin mutation)
    -   `delete` (admin mutation)
-   **Frontend Component:** Refactored `src/components/SeasonManager.tsx` to use tRPC hooks (`useQuery`, `useMutation`) instead of the manual `api.ts` functions.
-   **Type Safety:** The frontend now infers Types directly from the backend router. If you rename a field in the backend router, the frontend build will fail (correctly).

## Current State
-   **Build Status:** Passing (`npm run build`).
-   **Test Status:** Passing (`npm test`).
-   **Lint Status:** Passing (`npm run lint:all`).
-   **App Functionality:** The app starts successfully (`npm run dev:all`). The "Manage Seasons" tab uses tRPC. Other tabs (Leaderboard, Weeks, Segments) still use the legacy `api.ts` client.

## Next Steps (To-Do)

The migration is incremental. You can continue converting one service/component at a time.

1.  **Migrate Weeks:**
    -   Create `server/src/routers/week.ts`.
    -   Implement `getAll`, `getById`, `create`, `update`, `delete`.
    -   Add to `appRouter` in `server/src/routers/index.ts`.
    -   Update `src/components/WeekManager.tsx`, `src/components/ScheduleTable.tsx`, `src/components/SeasonWeekSelectors.tsx`.

2.  **Migrate Segments:**
    -   Create `server/src/routers/segment.ts`.
    -   Migrate logic from `server/src/routes/segments.ts`.
    -   Update `src/components/ManageSegments.tsx`.

3.  **Migrate Leaderboards:**
    -   Create `server/src/routers/leaderboard.ts`.
    -   Migrate `getWeekLeaderboard` and `getSeasonLeaderboard`.
    -   Update `src/components/WeeklyLeaderboard.tsx` and `src/components/SeasonLeaderboard.tsx`.

4.  **Cleanup:**
    -   Once all routes are migrated, delete `src/api.ts`.
    -   Remove the old Express routes in `server/src/routes/`.

## How to Resume Work

1.  **Pull the branch:** `git checkout feature/trpc-migration && git pull`
2.  **Install deps:** `npm install && cd server && npm install` (just to be safe)
3.  **Start dev server:** `npm run dev:all`
4.  **Pick a task:** Choose a domain (e.g., "Weeks") from the Next Steps list and implement the tRPC router for it.
