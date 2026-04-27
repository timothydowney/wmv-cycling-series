// Global teardown - runs after all test files complete

export default async () => {
  // All tests use pg-mem (in-memory Postgres) — no database files to clean up.
};
