/**
 * DEPRECATED: These tests have been moved to activityProcessor.test.js
 * 
 * This file is kept for backwards compatibility but is no longer actively maintained.
 * All validateActivityTimeWindow tests are now in activityProcessor.test.js with the module.
 * 
 * Reason for consolidation:
 * - Tests should be located with the module they test
 * - validateActivityTimeWindow is exported from activityProcessor.js
 * - Consolidating removes test duplication and improves maintainability
 * 
 * This file will be deleted in a future refactoring phase.
 */

// Import tests from activityProcessor to maintain backwards compatibility
require('./activityProcessor.test');
