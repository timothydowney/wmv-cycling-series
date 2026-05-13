import { getTableName, is, Table } from 'drizzle-orm';
import type { AnyPgTable } from 'drizzle-orm/pg-core';
import * as schema from '../db/schema';
import { POSTGRES_SCHEMA_DDL } from '../db/postgresSchemaDdl';

type IndexBuilderLike = { config?: { name?: string } };
type TimestampColumnLike = { withTimezone?: boolean; name?: string };
const tableSymbols = (Table as unknown as {
  Symbol: { ExtraConfigBuilder: symbol; ExtraConfigColumns: symbol };
}).Symbol;

function isDrizzleTable(value: unknown): value is AnyPgTable {
  return is(value, Table);
}

function isTimestampColumn(value: unknown): value is TimestampColumnLike {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const typedValue = value as TimestampColumnLike;
  return typedValue.withTimezone === true && typeof typedValue.name === 'string';
}

function getDrizzleTables(): AnyPgTable[] {
  return Object.values(schema).filter(isDrizzleTable);
}

function getDrizzleIndexNames(tables: AnyPgTable[]): string[] {
  const names: string[] = [];

  for (const table of tables) {
    const tableCandidate = table as unknown as Record<symbol, unknown>;
    const extraConfigBuilder = tableCandidate[tableSymbols.ExtraConfigBuilder];
    const extraConfigColumns = tableCandidate[tableSymbols.ExtraConfigColumns];
    if (typeof extraConfigBuilder !== 'function') {
      continue;
    }

    const extraConfig = extraConfigBuilder(extraConfigColumns);
    const indexBuilders = Array.isArray(extraConfig) ? extraConfig : [];
    for (const builder of indexBuilders as IndexBuilderLike[]) {
      if (builder?.config?.name) {
        names.push(builder.config.name);
      }
    }
  }

  return names.sort();
}

function getDrizzleTimestamptzColumns(tables: AnyPgTable[]): string[] {
  const columns: string[] = [];

  for (const table of tables) {
    const tableName = getTableName(table);
    for (const value of Object.values(table)) {
      if (isTimestampColumn(value)) {
        columns.push(`${tableName}.${value.name}`);
      }
    }
  }

  return columns.sort();
}

function getDdlTableNames(): string[] {
  return POSTGRES_SCHEMA_DDL
    .map((statement) => statement.match(/^CREATE TABLE IF NOT EXISTS\s+([a-z_][a-z0-9_]*)\s+\(/i)?.[1])
    .filter((name): name is string => Boolean(name))
    .sort();
}

function getDdlIndexNames(): string[] {
  return POSTGRES_SCHEMA_DDL
    .map((statement) => statement.match(/^CREATE (?:UNIQUE )?INDEX IF NOT EXISTS\s+([a-z_][a-z0-9_]*)\s+/i)?.[1])
    .filter((name): name is string => Boolean(name))
    .sort();
}

function getDdlTimestamptzColumns(): string[] {
  const columns: string[] = [];

  for (const statement of POSTGRES_SCHEMA_DDL) {
    const tableMatch = statement.match(/^CREATE TABLE IF NOT EXISTS\s+([a-z_][a-z0-9_]*)\s+\((.*)\)$/i);
    if (!tableMatch) {
      continue;
    }

    const [, tableName, tableBody] = tableMatch;
    const timestamptzColumnRegex = /\b([a-z_][a-z0-9_]*)\s+TIMESTAMPTZ\b/gi;
    for (const match of tableBody.matchAll(timestamptzColumnRegex)) {
      columns.push(`${tableName}.${match[1]}`);
    }
  }

  return columns.sort();
}

describe('schema definitions stay in sync', () => {
  it('keeps table definitions aligned between Drizzle and Postgres bootstrap DDL', () => {
    const drizzleTables = getDrizzleTables();
    const drizzleTableNames = drizzleTables.map((table) => getTableName(table)).sort();

    expect(getDdlTableNames()).toEqual(drizzleTableNames);
  });

  it('keeps index definitions aligned between Drizzle and Postgres bootstrap DDL', () => {
    const drizzleTables = getDrizzleTables();

    expect(getDdlIndexNames()).toEqual(getDrizzleIndexNames(drizzleTables));
  });

  it('keeps timestamptz columns aligned between Drizzle and Postgres bootstrap DDL', () => {
    const drizzleTables = getDrizzleTables();

    expect(getDdlTimestamptzColumns()).toEqual(getDrizzleTimestamptzColumns(drizzleTables));
  });
});
