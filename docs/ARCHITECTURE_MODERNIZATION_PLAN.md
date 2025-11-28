# Architecture Analysis & Modernization Plan

## Executive Summary

The `wmv-cycling-series` project is a functional full-stack application using React and Node.js. However, its current architecture relies heavily on manual type definitions and raw SQL queries, effectively bypassing the primary benefits of using TypeScript. This "illusion of type safety" creates a fragile codebase where compile-time checks often fail to catch runtime errors, particularly at the boundaries (Database <-> Backend <-> Frontend).

This report outlines the current architectural state and proposes a phased modernization plan to introduce true end-to-end type safety without requiring a complete rewrite.

## Current Architecture Analysis

### 1. Backend: The "Raw SQL" Bottleneck
*   **Data Access:** The backend uses `better-sqlite3` with raw SQL strings for all database interactions.
*   **Type Safety:** Types are manually defined in `server/src/types/database.ts` and are not guaranteed to match the actual database schema or the raw SQL query results.
*   **Pattern:** Services typically follow this unsafe pattern:
    ```typescript
    // Unsafe cast: Compile says yes, Runtime says maybe
    const result = db.prepare('SELECT * ...').all() as WeekRow[];
    ```
*   **Risk:** Adding a column requires manual updates in three places: the SQL migration, the `schema.ts` (for tests), and the TypeScript interface. Missing one leads to silent failures.

### 2. Frontend-Backend Bridge: The "Duplicate & Pray" Pattern
*   **API Client:** The frontend uses a manual `fetch` wrapper in `src/api.ts`.
*   **Type Duplication:** Core domain entities (like `Season`, `Week`) are redefined in `src/api.ts`, duplicating the logic in `server/src/types/database.ts`.
*   **Risk:** If the backend API response changes, the frontend build will still pass, but the application will crash at runtime because the frontend's interface definitions are out of sync with reality.

### 3. Testing Strategy
*   **Current State:** Tests are robust but tightly coupled to the implementation details. They spin up an in-memory SQLite database and execute raw SQL to seed data.
*   **Implication:** Any move to an ORM will require updating test setup helpers, though the logic being tested (the service methods) can remain largely the same.

## Recommended Modernization Plan

We recommend a **"Outside-In"** approach, prioritizing the Developer Experience (DX) and safety of the API layer first, followed by the Database layer.

### Phase 1: End-to-End Type Safety (The "Quick Win")
**Goal:** Eliminate the manual API client and duplicated types.

1.  **Adopt tRPC:** Replace the manual `src/api.ts` with **tRPC**.
    *   **Why?** tRPC allows you to export your backend router's type signature to the frontend. You call backend functions directly from React components with full autocompletion and type checking.
    *   **Impact:** No more `fetch('/api/weeks')`. Instead: `trpc.week.getAll.useQuery()`.
    *   **Effort:** Medium. Requires setting up the tRPC router on the backend and the provider on the frontend. Existing Express routes can be migrated one by one.

### Phase 2: Database Type Safety (The "Foundation")
**Goal:** Eliminate raw SQL and manual `as Any` casting.

1.  **Adopt Drizzle ORM:** Introduce **Drizzle ORM**.
    *   **Why?** Drizzle is lightweight, SQL-like, and has best-in-class TypeScript support. Unlike heavier ORMs (Prisma/TypeORM), it won't hide the SQL logic you already have, making the migration easier.
    *   **Impact:**
        *   **Before:** `db.prepare('SELECT * FROM season WHERE id = ?').get(id) as SeasonRow`
        *   **After:** `await db.select().from(seasons).where(eq(seasons.id, id))` (Result is automatically typed as `Season`)
    *   **Effort:** Medium/High. Can be done incrementally service-by-service.

### Phase 3: Shared Monorepo Structure (The "Cleanup")
**Goal:** formalized code sharing.

1.  **Workspaces:** If not already configured, ensure strict workspace separation between `client` and `server` packages.
2.  **Shared Package:** Create a `packages/shared` (or similar) folder for Zod schemas that are used for both database validation and API input validation.

## Immediate Actionable Steps (Pilot)

To validate this approach without halting feature development, I recommend a **Vertical Slice Pilot**:

1.  **Install Drizzle ORM** in the backend and generate the schema from your existing SQLite database (introspection).
2.  **Refactor ONE Service:** Pick a simple one like `SeasonService`. Rewrite its methods using Drizzle.
3.  **Verify:** Ensure tests pass (updating test setup if needed).

This will immediately demonstrate the value of automatic type inference without committing to a full-scale rewrite.
