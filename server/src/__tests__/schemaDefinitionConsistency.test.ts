import { getTableName } from 'drizzle-orm';
import * as schema from '../db/schema';
import { POSTGRES_SCHEMA_DDL } from '../db/postgresSchemaDdl';

function getDrizzleTables(): any[] {
  return Object.values(schema).filter((value: any) => {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const isDrizzleTableSymbol = Object.getOwnPropertySymbols(value).find(
      (symbol) => String(symbol) === 'Symbol(drizzle:IsDrizzleTable)'
    );
    return Boolean(isDrizzleTableSymbol && value[isDrizzleTableSymbol]);
  });
}

function getDrizzleIndexNames(tables: any[]): string[] {
  const names: string[] = [];

  for (const table of tables) {
    const symbols = Object.getOwnPropertySymbols(table);
    const extraConfigBuilderSymbol = symbols.find((symbol) => String(symbol) === 'Symbol(drizzle:ExtraConfigBuilder)');
    const extraConfigColumnsSymbol = symbols.find((symbol) => String(symbol) === 'Symbol(drizzle:ExtraConfigColumns)');
    if (!extraConfigBuilderSymbol || !extraConfigColumnsSymbol) {
      continue;
    }

    const extraConfigBuilder = table[extraConfigBuilderSymbol];
    const extraConfigColumns = table[extraConfigColumnsSymbol];
    if (typeof extraConfigBuilder !== 'function') {
      continue;
    }

    const extraConfig = extraConfigBuilder(extraConfigColumns);
    const indexBuilders = Array.isArray(extraConfig) ? extraConfig : [];
    for (const builder of indexBuilders) {
      if (builder?.config?.name) {
        names.push(builder.config.name);
      }
    }
  }

  return names.sort();
}

function getDrizzleTimestamptzColumns(tables: any[]): string[] {
  const columns: string[] = [];

  for (const table of tables) {
    const tableName = getTableName(table);
    for (const value of Object.values(table)) {
      const column = value as any;
      if (!column || typeof column !== 'object') {
        continue;
      }

      if (column.withTimezone === true && typeof column.name === 'string') {
        columns.push(`${tableName}.${column.name}`);
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
    let match = timestamptzColumnRegex.exec(tableBody);
    while (match) {
      columns.push(`${tableName}.${match[1]}`);
      match = timestamptzColumnRegex.exec(tableBody);
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
