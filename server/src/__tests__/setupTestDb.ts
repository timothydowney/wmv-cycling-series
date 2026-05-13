import { newDb } from 'pg-mem';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import * as schema from '../db/schema';
import { POSTGRES_SCHEMA_DDL } from '../db/postgresSchemaDdl';
import type { AppDatabase } from '../db/types';

export interface SeedData {
  seasons: any[];
  weeks: any[];
}

export interface TestDbResult {
  orm: AppDatabase;
  drizzleDb: AppDatabase;
  pool: Pool;
  seedData?: SeedData;
}

export function setupTestDb(options?: { seed?: boolean }): TestDbResult {
  const { seed = true } = options || {};

  // Each test file gets its own isolated in-memory Postgres instance.
  const memDb = newDb();

  // Keep timestamptz behavior deterministic across developer machines and CI.
  memDb.public.none("SET TIME ZONE 'UTC'");

  // Bootstrap schema synchronously via pg-mem's direct interface.
  for (const stmt of POSTGRES_SCHEMA_DDL) {
    memDb.public.none(stmt);
  }

  let seedData: SeedData | undefined = undefined;

  if (seed) {
    // Seed synchronously via pg-mem's direct SQL interface so this function
    // stays synchronous and test files don't need async beforeAll just for setup.
    memDb.public.none('INSERT INTO participant (strava_athlete_id, name, active) VALUES (\'100\', \'Test User 1\', true)');
    memDb.public.none('INSERT INTO participant (strava_athlete_id, name, active) VALUES (\'200\', \'Test User 2\', true)');
    const testSeason = memDb.public.one('INSERT INTO season (name, start_at, end_at) VALUES (\'Test Season\', 1735689600, 1767225599) RETURNING *') as any;
    memDb.public.none('INSERT INTO segment (strava_segment_id, name) VALUES (\'1000\', \'Test Segment\')');
    const testWeek = memDb.public.one(`INSERT INTO week (season_id, week_name, strava_segment_id, required_laps, start_at, end_at) VALUES (${testSeason.id}, 'Test Week', '1000', 1, 1748736000, 1748793600) RETURNING *`) as any;
    const testActivity1 = memDb.public.one(`INSERT INTO activity (week_id, strava_athlete_id, strava_activity_id, start_at) VALUES (${testWeek.id}, '100', '${Math.floor(Math.random() * 1e9)}', 1748772000) RETURNING *`) as any;
    const testActivity2 = memDb.public.one(`INSERT INTO activity (week_id, strava_athlete_id, strava_activity_id, start_at) VALUES (${testWeek.id}, '200', '${Math.floor(Math.random() * 1e9)}', 1748775600) RETURNING *`) as any;
    memDb.public.none(`INSERT INTO result (week_id, strava_athlete_id, activity_id, total_time_seconds) VALUES (${testWeek.id}, '100', ${testActivity1.id}, 100)`);
    memDb.public.none(`INSERT INTO result (week_id, strava_athlete_id, activity_id, total_time_seconds) VALUES (${testWeek.id}, '200', ${testActivity2.id}, 200)`);
    seedData = { seasons: [testSeason], weeks: [testWeek] };
  }

  // Wire up Drizzle over the pg-mem pool adapter.
  const { Pool } = memDb.adapters.createPg();
  // drizzle/node-postgres passes query.types.getTypeParser for parameterized
  // queries; pg-mem does not implement that API, so strip it in tests.
  const proto = (Pool as any).prototype;
  if (!proto.__wmvPatchedAdaptQuery) {
    const originalAdaptQuery = proto.adaptQuery;
    const originalAdaptResults = proto.adaptResults;
    proto.adaptQuery = function patchedAdaptQuery(query: any, values: any) {
      if (query && typeof query === 'object' && 'types' in query) {
        const cloned = { ...query };
        delete cloned.types;
        return originalAdaptQuery.call(this, cloned, values);
      }
      return originalAdaptQuery.call(this, query, values);
    };
    proto.adaptResults = function patchedAdaptResults(query: any, res: any) {
      if (query && typeof query === 'object' && query.rowMode === 'array') {
        const base = originalAdaptResults.call(this, { ...query, rowMode: undefined }, res);
        const fieldNames = (res.fields || []).map((f: any) => f.name);
        return {
          ...base,
          rows: base.rows.map((row: Record<string, unknown>) => fieldNames.map((name: string) => row[name])),
          fields: fieldNames.map((name: string, idx: number) => ({
            name,
            tableID: 0,
            columnID: idx + 1,
            dataTypeID: 0,
            dataTypeSize: -1,
            dataTypeModifier: -1,
            format: 'text',
          })),
        };
      }
      return originalAdaptResults.call(this, query, res);
    };
    proto.__wmvPatchedAdaptQuery = true;
  }
  const pool = new Pool() as unknown as import('pg').Pool;
  const orm = drizzle(pool, { schema }) as AppDatabase;
  const drizzleDb = orm; // alias for backward compat

  return { orm, drizzleDb, pool, seedData };
}

// End the pool when a test file is done. Safe to call multiple times.
export async function teardownTestDb(pool: Pool): Promise<void> {
  try { await pool.end(); } catch { /* already closed */ }
}
