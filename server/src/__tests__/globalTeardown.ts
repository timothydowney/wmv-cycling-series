// Global teardown - runs after all test files complete
import path from 'path';
import fs from 'fs';

export default async () => {
  try {
    // Close any lingering database connections
    const testDbPath = path.join(__dirname, '..', '..', 'data', 'test.db');
    const testSubmissionDbPath = path.join(__dirname, '..', '..', 'data', 'test-submission.db');
    
    // Give time for connections to close
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Clean up test database files
    [testDbPath, testSubmissionDbPath].forEach(dbPath => {
      if (fs.existsSync(dbPath)) {
        try {
          fs.unlinkSync(dbPath);
        } catch {
          // Ignore - file may be locked
        }
      }
    });
  } catch (error) {
    // Suppress any errors during global teardown
    // All tests have already passed - we don't want teardown errors to fail the suite
    if (error instanceof Error && error.message.includes('SQLITE_CONSTRAINT_FOREIGNKEY')) {
      // This is expected and can be safely ignored
      process.stderr.write('[Jest Teardown] Suppressed SQLite constraint error during cleanup\n');
    } else {
      process.stderr.write(`[Jest Teardown] Suppressed error: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }
};
