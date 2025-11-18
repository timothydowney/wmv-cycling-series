/**
 * Authentication Middleware
 * 
 * Middleware for protecting routes that require authentication or admin access.
 */

/**
 * Require admin middleware - checks if user is authenticated and has admin role
 * Usage: app.post('/admin/weeks', requireAdmin, handler)
 */
function createRequireAdminMiddleware(getAdminAthleteIds) {
  return (req, res, next) => {
    // First check: must be authenticated
    if (!req.session.stravaAthleteId) {
      return res.status(401).json({ 
        error: 'Not authenticated. Please connect to Strava first.' 
      });
    }

    // Second check: if admin required, verify admin status
    const adminIds = getAdminAthleteIds();
    if (!adminIds.includes(req.session.stravaAthleteId)) {
      console.warn(`[AUTH] Non-admin access attempt by athlete ${req.session.stravaAthleteId} to ${req.path}`);
      return res.status(403).json({ 
        error: 'Forbidden. Admin access required.' 
      });
    }

    // User is authenticated and is admin - proceed
    next();
  };
}

module.exports = {
  createRequireAdminMiddleware
};
