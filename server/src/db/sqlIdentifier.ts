import { escapeIdentifier } from 'pg';

export function buildCountRowsQuery(tableName: string): string {
  return `SELECT COUNT(*)::int AS cnt FROM ${escapeIdentifier(tableName)}`;
}
