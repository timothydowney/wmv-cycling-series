/**
 * routes/auth.ts
 *
 * OAuth authentication and session management routes
 * - Initiate OAuth flow with Strava
 * - Handle OAuth callback and token exchange
 * - Check authentication status
 * - Disconnect Strava account
 */

import { Router, Request, Response } from 'express';
import type { Session } from 'express-session';
import type LoginService from '../services/LoginService';
import { config, getStravaConfig } from '../config';

interface AuthServices {
  loginService: LoginService;
}

export default (services: AuthServices): Router => {
  const { loginService } = services;
  const router = Router();

  /**
   * GET /auth/strava
   * Initiate OAuth flow - redirect to Strava authorization endpoint
   */
  router.get('/strava', (_req: Request, res: Response) => {
    // Use configured redirect URI (derived from APP_BASE_URL or explicit FRONTEND_URL/BACKEND_URL)
    const redirectUri = config.stravaRedirectUri;

    // Helpful runtime trace (does not log secrets)
    console.log('[AUTH] Using OAuth redirect URI:', redirectUri);
    console.log('[AUTH] Using frontend URL:', config.frontendUrl);

    const { clientId } = getStravaConfig();
    const stravaAuthUrl =
      'https://www.strava.com/oauth/authorize?' +
      new URLSearchParams({
        client_id: clientId || '',
        redirect_uri: redirectUri,
        response_type: 'code',
        approval_prompt: 'auto',
        scope: 'activity:read,profile:read_all'
      });

    console.log('Redirecting to Strava OAuth:', stravaAuthUrl);
    res.redirect(stravaAuthUrl);
  });

  /**
   * GET /auth/strava/callback
   * Handle OAuth callback - exchange code for tokens and create session
   */
  router.get('/strava/callback', async (req: Request, res: Response) => {
    const { code } = req.query as { code?: string };

    if (!code) {
      console.error('OAuth callback missing authorization code');
      return res.redirect(`${config.frontendUrl}?error=authorization_denied`);
    }

    try {
      // Use LoginService to exchange code and create session
      const { athleteId, athleteName, isAdmin } = await loginService.exchangeCodeAndCreateSession(
        code
      );

      // Attach to session with typed fields
      const sess = req.session as Session & {
        stravaAthleteId?: number;
        athleteName?: string;
        isAdmin?: boolean;
      };
      sess.stravaAthleteId = athleteId;
      sess.athleteName = athleteName;
      sess.isAdmin = isAdmin;

      // Explicitly save session before redirecting (important for some session stores)
      console.log(`[AUTH] Saving session for athlete ${athleteId}...`);
      console.log('[AUTH] Session data before save:', {
        stravaAthleteId: athleteId,
        athleteName,
        sessionID: req.sessionID
      });

      req.session.save((err: Error | null) => {
        if (err) {
          console.error('[AUTH] Session save error:', err);
          res.redirect(`${config.frontendUrl}?error=session_error`);
          return;
        }

        console.log(`[AUTH] Session saved successfully for athlete ${athleteId}`);
        console.log(`[AUTH] Session ID: ${req.sessionID}`);

        // Redirect to dashboard using configured frontend URL
        const finalRedirect = `${config.frontendUrl}?connected=true`;

        console.log(`[AUTH] Redirecting to ${finalRedirect}`);
        // The rolling: true option in sessionConfig ensures the Set-Cookie header is sent
        res.redirect(finalRedirect);
      });
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.redirect(`${config.frontendUrl}?error=server_error`);
    }
  });

  /**
   * GET /auth/status
   * Check current authentication status
   */
  router.get('/status', async (req: Request, res: Response): Promise<void> => {
    const sess = req.session as Session & {
      stravaAthleteId?: number;
      athleteName?: string;
      isAdmin?: boolean;
    };

    try {
      console.log('[AUTH] /auth/status called');
      console.log('[AUTH] Session ID:', req.sessionID);
      console.log('[AUTH] Session object keys:', Object.keys(sess));
      console.log('[AUTH] Full session object:', JSON.stringify(sess, null, 2).substring(0, 500));
      const athleteId = sess.stravaAthleteId;
      console.log('[AUTH] athleteId from session:', athleteId, 'type:', typeof athleteId);
      
      if (!athleteId) {
        console.log('[AUTH] No athleteId in session, returning unauthenticated');
        res.json({
          authenticated: false,
          participant: null,
          is_admin: false
        });
        return;
      }

      // Use LoginService to get full auth status
      const status = await loginService.getAuthStatus(athleteId);
      res.json(status);
    } catch (error) {
      console.error('Error getting auth status:', error);
      res.status(500).json({ error: 'Failed to get auth status' });
    }
  });

  /**
   * POST /auth/disconnect
   * Disconnect Strava account and destroy session
   */
  router.post('/disconnect', (req: Request, res: Response): void => {
    const sess = req.session as Session & {
      stravaAthleteId?: number;
    };
    const athleteId = sess.stravaAthleteId;
    if (!athleteId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    try {
      // Use LoginService to disconnect (delete tokens)
      loginService.disconnectStrava(athleteId);

      // Destroy session
      req.session.destroy((err: Error | null) => {
        if (err) {
          console.error('Session destruction error:', err);
          res.status(500).json({ error: 'Failed to disconnect' });
          return;
        }
        res.json({ success: true, message: 'Disconnected from Strava' });
      });
    } catch (error) {
      console.error('Error disconnecting Strava:', error);
      res.status(500).json({ error: 'Failed to disconnect from Strava' });
    }
  });

  return router;
};
