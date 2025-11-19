// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/**
 * Test-Only Middleware for Session Injection
 * 
 * This file is ONLY loaded during testing.
 * It provides:
 * - Auto-injection of admin session for /admin routes
 * - Support for X-Override-Athlete-Id header to simulate non-admin users
 * 
 * SECURITY: This file is excluded from production builds and should never be
 * loaded in production. It exists only in source code, not in deployed artifacts.
 */

/**
 * Register test session middleware
 * Only call this in test environments
 * 
 * @param {Express} app - Express application instance
 */
function registerTestMiddleware(app) {
  app.use((req, res, next) => {
    // Check for header override FIRST (used by makeRequestAsUser helper for non-admin tests)
    // This takes precedence so non-admin tests can override the default admin session
    const overrideAthleteId = req.get('X-Override-Athlete-Id');
    
    if (overrideAthleteId) {
      // Non-admin test: use the override athlete ID (which is NOT in ADMIN_ATHLETE_IDS)
      req.session.stravaAthleteId = parseInt(overrideAthleteId, 10);
      req.session.athleteName = `Test User ${overrideAthleteId}`;
      req.session.save(() => next());
    } else if (!req.session.stravaAthleteId) {
      // No override header, and session not already set
      // For /admin routes, auto-inject admin ID; otherwise leave unauthenticated
      if (req.path.startsWith('/admin')) {
        req.session.stravaAthleteId = 999001; // Test admin ID
        req.session.athleteName = 'Test Admin';
        req.session.save(() => next());
      } else {
        next();
      }
    } else {
      next();
    }
  });
}

module.exports = registerTestMiddleware;
