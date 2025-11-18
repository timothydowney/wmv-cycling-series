/**
 * Authorization Service
 * 
 * Handles role-based access control logic:
 * - Admin role checks
 * - Permission validation
 * - Authorization decisions
 */

class AuthorizationService {
  constructor(adminAthleteIds) {
    this.adminAthleteIds = adminAthleteIds || [];
  }

  /**
   * Check if an athlete ID is an admin
   * @param {number} stravaAthleteId - Strava athlete ID
   * @returns {boolean}
   */
  isAdmin(stravaAthleteId) {
    return this.adminAthleteIds.includes(stravaAthleteId);
  }

  /**
   * Validate authorization for an action
   * @param {number} stravaAthleteId - Athlete ID from session
   * @param {string} requiredRole - Role needed ('admin', 'authenticated', 'public')
   * @returns {Object} { authorized, statusCode, message }
   */
  checkAuthorization(stravaAthleteId, requiredRole = 'authenticated') {
    // Must be authenticated for any protected route
    if (requiredRole !== 'public' && !stravaAthleteId) {
      return {
        authorized: false,
        statusCode: 401,
        message: 'Not authenticated'
      };
    }

    // Check admin role if required
    if (requiredRole === 'admin' && !this.isAdmin(stravaAthleteId)) {
      return {
        authorized: false,
        statusCode: 403,
        message: 'Admin access required'
      };
    }

    return {
      authorized: true,
      statusCode: 200
    };
  }
}

module.exports = AuthorizationService;
