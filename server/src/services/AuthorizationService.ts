/**
 * Authorization Service
 *
 * Handles role-based access control logic:
 * - Admin role checks (based on Strava athlete IDs)
 * - Permission validation
 * - Authorization decisions
 * - Express middleware creation
 */

import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { participant } from '../db/schema';

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
    stravaAthleteId?: string;
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
  private orm?: BetterSQLite3Database;
  private getAdminAthleteIds: () => string[];

  /**
   * Initialize authorization service with admin athlete ID resolver
   * @param getAdminAthleteIds - Function that returns array of admin athlete IDs
   */
  constructor(orm?: BetterSQLite3Database, getAdminAthleteIds?: () => string[]) {
    this.orm = orm;
    this.getAdminAthleteIds = getAdminAthleteIds || (() => []);
  }

  /**
   * Check if an athlete ID is an admin
   * @param stravaAthleteId - Strava athlete ID
   * @returns Whether the athlete is an admin
   */
  isAdmin(stravaAthleteId: string | null | undefined): boolean {
    if (!stravaAthleteId) {
      return false;
    }

    const adminIds = this.getAdminAthleteIds();
    if (adminIds.includes(stravaAthleteId)) {
      return true;
    }

    if (!this.orm) {
      return false;
    }

    const participantRow = this.orm
      .select({ is_admin: participant.is_admin })
      .from(participant)
      .where(eq(participant.strava_athlete_id, stravaAthleteId))
      .get();

    return Boolean(participantRow?.is_admin);
  }

  /**
   * Check authorization for a specific athlete
   * Used by middleware and tests
   * @param stravaAthleteId - Athlete ID from session (or null if not authenticated)
   * @param adminRequired - Whether admin role is required (default: false)
   * @returns { authorized: boolean, statusCode: number, message?: string }
   */
  checkAuthorization(
    stravaAthleteId: string | null | undefined,
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
        req.session?.stravaAthleteId ? String(req.session.stravaAthleteId) : undefined,
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
