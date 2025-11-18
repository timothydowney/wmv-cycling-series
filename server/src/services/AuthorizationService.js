/**
 * Authorization Service
 * 
 * Handles role-based access control logic:
 * - Admin role checks (based on Strava athlete IDs)
 * - Permission validation
 * - Authorization decisions
 * - Express middleware creation
 */

class AuthorizationService {
  /**
   * Initialize authorization service with admin athlete ID resolver
   * @param {Function} getAdminAthleteIds - Function that returns array of admin athlete IDs
   */
  constructor(getAdminAthleteIds) {
    this.getAdminAthleteIds = getAdminAthleteIds || (() => []);
  }

  /**
   * Check if an athlete ID is an admin
   * @param {number} stravaAthleteId - Strava athlete ID
   * @returns {boolean}
   */
  isAdmin(stravaAthleteId) {
    const adminIds = this.getAdminAthleteIds();
    return adminIds.includes(stravaAthleteId);
  }

  /**
   * Check authorization for a specific athlete
   * Used by middleware and tests
   * @param {number} stravaAthleteId - Athlete ID from session (or null if not authenticated)
   * @param {boolean} adminRequired - Whether admin role is required (default: false)
   * @returns {Object} { authorized: boolean, statusCode: number, message?: string }
   */
  checkAuthorization(stravaAthleteId, adminRequired = false) {
    // First check: must be authenticated for protected routes
    if (!stravaAthleteId) {
      return {
        authorized: false,
        statusCode: 401,
        message: 'Not authenticated. Please connect to Strava first.'
      };
    }

    // Second check: verify admin status if required
    if (adminRequired && !this.isAdmin(stravaAthleteId)) {
      return {
        authorized: false,
        statusCode: 403,
        message: 'Forbidden. Admin access required.'
      };
    }

    return {
      authorized: true,
      statusCode: 200
    };
  }

  /**
   * Create Express middleware for admin role enforcement
   * @returns {Function} Express middleware (req, res, next) => void
   */
  createRequireAdminMiddleware() {
    return (req, res, next) => {
      const authCheck = this.checkAuthorization(req.session.stravaAthleteId, true);

      if (!authCheck.authorized) {
        if (authCheck.statusCode === 401) {
          console.warn(`[AUTH] Unauthenticated access attempt to ${req.path}`);
        } else if (authCheck.statusCode === 403) {
          console.warn(`[AUTH] Non-admin access attempt by athlete ${req.session.stravaAthleteId} to ${req.path}`);
        }
        return res.status(authCheck.statusCode).json({ error: authCheck.message });
      }

      next();
    };
  }
}

module.exports = AuthorizationService;
