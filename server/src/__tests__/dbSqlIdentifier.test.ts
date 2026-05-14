import { buildCountRowsQuery } from '../db/sqlIdentifier';

describe('buildCountRowsQuery', () => {
  it('builds a count query with a safely escaped identifier', () => {
    expect(buildCountRowsQuery('participant')).toBe('SELECT COUNT(*)::int AS cnt FROM "participant"');
  });

  it('escapes quotes in table names', () => {
    expect(buildCountRowsQuery('table"name; DROP TABLE result;--')).toBe(
      'SELECT COUNT(*)::int AS cnt FROM "table""name; DROP TABLE result;--"'
    );
  });
});
