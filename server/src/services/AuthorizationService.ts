/**
 * Authorization Service
 *
 * Handles role-based access control logic:
 * - Admin role checks (based on Strava athlete IDs)
 * - Permission validation
 * - Authorization decisions
 * - Express middleware creation
 */

/**
 * Authorization check result
 */
interface AuthorizationResult {
  authorized: boolean;
  statusCode: number;
  message?: string;
}

/**
 * Express request-like interface for middleware
 */
interface Request {
  session?: {
    stravaAthleteId?: number;
    [key: string]: unknown;
  };
  path?: string;
  [key: string]: unknown;
}

/**
 * Express response-like interface for middleware
 */
interface Response {
  status(code: number): Response;
  json(data: Record<string, unknown>): Response;
}

/**
 * Middleware next function
 */
type NextFunction = () => void;

class AuthorizationService {
  private getAdminAthleteIds: () => number[];

  /**
   * Initialize authorization service with admin athlete ID resolver
   * @param getAdminAthleteIds - Function that returns array of admin athlete IDs
   */
  constructor(getAdminAthleteIds?: () => number[]) {
    this.getAdminAthleteIds = getAdminAthleteIds || (() => []);
  }

  /**
   * Check if an athlete ID is an admin
   * @param stravaAthleteId - Strava athlete ID
   * @returns Whether the athlete is an admin
   */
  isAdmin(stravaAthleteId: number | null | undefined): boolean {
    if (!stravaAthleteId) {
      return false;
    }
    const adminIds = this.getAdminAthleteIds();
    return adminIds.includes(stravaAthleteId);
  }

  /**
   * Check authorization for a specific athlete
   * Used by middleware and tests
   * @param stravaAthleteId - Athlete ID from session (or null if not authenticated)
   * @param adminRequired - Whether admin role is required (default: false)
   * @returns { authorized: boolean, statusCode: number, message?: string }
   */
  checkAuthorization(
    stravaAthleteId: number | null | undefined,
    adminRequired = false
  ): AuthorizationResult {
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
   * @returns Express middleware (req, res, next) => void
   */
  createRequireAdminMiddleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const authCheck = this.checkAuthorization(
        req.session?.stravaAthleteId,
        true
      );

      if (!authCheck.authorized) {
        if (authCheck.statusCode === 401) {
          console.warn(`[AUTH] Unauthenticated access attempt to ${req.path}`);
        } else if (authCheck.statusCode === 403) {
          console.warn(
            `[AUTH] Non-admin access attempt by athlete ${req.session?.stravaAthleteId} to ${req.path}`
          );
        }
        res.status(authCheck.statusCode).json({ error: authCheck.message });
        return;
      }

      next();
    };
  }
}

export { AuthorizationService, type AuthorizationResult };
