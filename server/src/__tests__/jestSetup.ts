// Jest global setup — runs before each test file (setupFiles, not setupFilesAfterFramework).
// Sets the minimum environment variables required so that importing db.ts / config.ts
// in tests does not throw, even though tests use the pg-mem in-memory database.
// The real DATABASE_URL is never actually dialled in tests because setupTestDb()
// overrides the database connection via dbOverride / ormOverride in createContext.

process.env.DB_DIALECT = 'postgres';
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/testdb_pgmem';
// Provide other required env vars with safe test defaults if not already set.
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'test';
if (!process.env.STRAVA_CLIENT_ID) process.env.STRAVA_CLIENT_ID = 'test_client_id';
if (!process.env.STRAVA_CLIENT_SECRET) process.env.STRAVA_CLIENT_SECRET = 'test_client_secret';
if (!process.env.ENCRYPTION_KEY) process.env.ENCRYPTION_KEY = 'test_encryption_key_32_chars_long!!';
if (!process.env.SESSION_SECRET) process.env.SESSION_SECRET = 'test_session_secret';
if (!process.env.ADMIN_ATHLETE_IDS) process.env.ADMIN_ATHLETE_IDS = '999001';
