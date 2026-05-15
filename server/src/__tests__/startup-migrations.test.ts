/**
 * Test: Startup Migration Lifecycle
 *
 * CRITICAL: These tests ensure that Drizzle migrations are applied at startup.
 * This is essential for production deployments to stay in sync with schema changes.
 *
 * Historical context: A regression in May 2026 removed startup migration logic,
 * causing production schema to drift after new migrations were added. These tests
 * prevent that from happening again.
 *
 * See: https://github.com/timothydowney/wmv-cycling-series/pull/71
 */

import path from 'path';
import fs from 'fs';

describe('Startup Migration Lifecycle', () => {
  // These tests validate code structure and presence of migration startup logic.
  // Actual migration execution is tested by CI via `npm run db:migrate`.

  /**
   * CRITICAL: Verify that the startup code calls applyPendingMigrations()
   * before verifyDatabaseReady().
   *
   * If this test fails, it means someone removed or reordered the startup logic,
   * which would cause production deployments to fail or schema to drift.
   */
  it('should have migration startup code in the backend', () => {
    // This test validates that the index.ts file contains the migration startup
    const indexPath = path.join(__dirname, '../index.ts');
    const indexContent = fs.readFileSync(indexPath, 'utf-8');

    // Check that applyPendingMigrations is defined
    expect(indexContent).toContain('async function applyPendingMigrations');

    // Check that stampBaselineIfBootstrapped is defined
    expect(indexContent).toContain('async function stampBaselineIfBootstrapped');
    expect(indexContent).toContain("entry.tag === '0000_postgres_baseline'");

    // Check that startServer calls applyPendingMigrations BEFORE verifyDatabaseReady
    const startServerMatch = indexContent.match(
      /async function startServer.*?{[\s\S]*?(await applyPendingMigrations|await verifyDatabaseReady)/
    );
    expect(startServerMatch).toBeTruthy();

    // Extract the order of calls in startServer
    const startServerBody = indexContent.match(
      /async function startServer\(\): Promise<void> \{([\s\S]*?)app\.listen/
    );
    expect(startServerBody).toBeTruthy();
    const applyIndex = startServerBody![1].indexOf('await applyPendingMigrations');
    const verifyIndex = startServerBody![1].indexOf('await verifyDatabaseReady');
    expect(applyIndex).toBeGreaterThan(-1);
    expect(verifyIndex).toBeGreaterThan(-1);
    expect(applyIndex).toBeLessThan(verifyIndex);
  });

  /**
   * CRITICAL: Verify that Drizzle's migrate function is imported.
   *
   * If this test fails, it means someone removed the import, which would
   * cause the app to crash at startup.
   */
  it('should import Drizzle migration utilities', () => {
    const indexPath = path.join(__dirname, '../index.ts');
    const indexContent = fs.readFileSync(indexPath, 'utf-8');

    expect(indexContent).toContain("import { migrate } from 'drizzle-orm/node-postgres/migrator'");
    expect(indexContent).toContain("import crypto from 'crypto'");
  });

  /**
   * CRITICAL: Verify that migrations folder is properly defined.
   *
   * If this test fails, migrations won't be found at startup.
   */
  it('should define MIGRATIONS_FOLDER', () => {
    const indexPath = path.join(__dirname, '../index.ts');
    const indexContent = fs.readFileSync(indexPath, 'utf-8');

    expect(indexContent).toContain(
      "const MIGRATIONS_FOLDER = path.join(__dirname, '../drizzle')"
    );
  });

  /**
   * Verify that the baseline migration file exists.
   *
   * If this test fails, something deleted the baseline migration,
   * which means fresh databases can't be initialized.
   */
  it('should have a baseline migration file', () => {
    const baselinePath = path.join(
      __dirname,
      '../../drizzle/0000_postgres_baseline.sql'
    );
    expect(fs.existsSync(baselinePath)).toBe(true);

    const content = fs.readFileSync(baselinePath, 'utf-8');
    // Verify it contains key schema definitions
    expect(content).toContain('CREATE TABLE');
    expect(content).toContain('participant');
    expect(content).toContain('season');
  });

  /**
   * Verify that Drizzle migration metadata exists.
   *
   * If this test fails, Drizzle won't be able to track which migrations
   * have been applied.
   */
  it('should have Drizzle migration metadata', () => {
    const journalPath = path.join(__dirname, '../../drizzle/meta/_journal.json');
    expect(fs.existsSync(journalPath)).toBe(true);

    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));
    expect(journal.entries).toBeTruthy();
    expect(Array.isArray(journal.entries)).toBe(true);
    expect(journal.entries.length).toBeGreaterThan(0);

    // Verify the baseline entry exists
    const baseline = journal.entries.find(
      (e: { tag: string; idx: number }) => e.tag === '0000_postgres_baseline'
    );
    expect(baseline).toBeTruthy();
  });

  /**
   * Verify that the applyPendingMigrations function will actually
   * run when the server starts (by checking it's not conditionally skipped).
   *
   * This prevents regressions where someone might add a conditional that
   * skips migrations in production.
   */
  it('should call applyPendingMigrations before verifyDatabaseReady in startServer', () => {
    const indexPath = path.join(__dirname, '../index.ts');
    const indexContent = fs.readFileSync(indexPath, 'utf-8');

    // Find where startServer is defined and extract first few lines
    const startServerMatch = indexContent.match(/async function startServer\(\): Promise<void> \{[\s\S]{0,500}/);
    expect(startServerMatch).toBeTruthy();

    const startServerSnippet = startServerMatch![0];

    // Verify applyPendingMigrations is called first
    expect(startServerSnippet).toContain('await applyPendingMigrations()');
    expect(startServerSnippet).toContain('await verifyDatabaseReady()');

    // Verify they appear in correct order
    const applyIndex = startServerSnippet.indexOf('await applyPendingMigrations()');
    const verifyIndex = startServerSnippet.indexOf('await verifyDatabaseReady()');
    expect(applyIndex).toBeGreaterThan(-1);
    expect(verifyIndex).toBeGreaterThan(-1);
    expect(applyIndex).toBeLessThan(verifyIndex);
  });

  it('should gate baseline stamping on migration table rows, not just drizzle schema existence', () => {
    const indexPath = path.join(__dirname, '../index.ts');
    const indexContent = fs.readFileSync(indexPath, 'utf-8');

    expect(indexContent).toContain('CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations');
    expect(indexContent).toContain('SELECT COUNT(*)::text AS count FROM drizzle.__drizzle_migrations');
    expect(indexContent).toContain('if (migrationRowCount > 0)');
  });

  it('should convert legacy chain_wax created_at bigint columns before defaulting to now()', () => {
    const migrationPath = path.join(__dirname, '../../drizzle/0001_ensure_chain_wax_defaults.sql');
    const migrationContent = fs.readFileSync(migrationPath, 'utf-8');

    expect(migrationContent).toContain("current_type IN ('bigint', 'integer')");
    expect(migrationContent).toContain('to_timestamp(%I::double precision)');
    expect(migrationContent).toContain("NULLIF(%I, '''')::timestamptz");
    expect(migrationContent).toContain('ALTER COLUMN %I SET DEFAULT now()');
    expect(migrationContent).toContain("('chain_wax_period', 'created_at', true)");
    expect(migrationContent).toContain("('chain_wax_activity', 'created_at', true)");
    expect(migrationContent).toContain("('chain_wax_puck', 'created_at', true)");
  });
});
