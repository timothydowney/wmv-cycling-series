// Global teardown - runs after all test files complete
const path = require('path');
const fs = require('fs');

module.exports = async () => {
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
      } catch (err) {
        // Ignore - file may be locked
      }
    }
  });
};
