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
import type LoginService from '../services/LoginService';

interface AuthHelpers {
  getBaseUrl: (req: Request) => string;
  CLIENT_BASE_URL: string;
}

interface AuthServices {
  loginService: LoginService;
}

export default (services: AuthServices, helpers: AuthHelpers): Router => {
  const { loginService } = services;
  const { getBaseUrl, CLIENT_BASE_URL } = helpers;
  const router = Router();

  /**
   * GET /auth/strava
   * Initiate OAuth flow - redirect to Strava authorization endpoint
   */
  router.get('/strava', (req: Request, res: Response) => {
    // Compute redirect URI with safe fallback if env not set
    const computedRedirect = `${getBaseUrl(req)}/auth/strava/callback`;
    const redirectUri = process.env.STRAVA_REDIRECT_URI || computedRedirect;

    // Helpful runtime trace (does not log secrets)
    console.log('[AUTH] Using STRAVA_REDIRECT_URI:', redirectUri);
    console.log('[AUTH] Using CLIENT_BASE_URL:', CLIENT_BASE_URL || '(not set, will fallback)');

    const stravaAuthUrl =
      'https://www.strava.com/oauth/authorize?' +
      new URLSearchParams({
        client_id: process.env.STRAVA_CLIENT_ID || '',
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
      return res.redirect(`${CLIENT_BASE_URL}?error=authorization_denied`);
    }

    try {
      // Use LoginService to exchange code and create session
      const { athleteId, athleteName, isAdmin } = await loginService.exchangeCodeAndCreateSession(
        code
      );

      // Attach to session (cast to any to avoid session typing issues)
      const sess = req.session as any;
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
          res.redirect(`${CLIENT_BASE_URL}?error=session_error`);
          return;
        }

        console.log(`[AUTH] Session saved successfully for athlete ${athleteId}`);
        console.log(`[AUTH] Session ID: ${req.sessionID}`);

        // Redirect to dashboard with safe fallback to request base URL
        const baseUrl = CLIENT_BASE_URL || getBaseUrl(req);
        const finalRedirect = `${baseUrl}?connected=true`;

        console.log(`[AUTH] Redirecting to ${finalRedirect}`);
        // The rolling: true option in sessionConfig ensures the Set-Cookie header is sent
        res.redirect(finalRedirect);
      });
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.redirect(`${CLIENT_BASE_URL}?error=server_error`);
    }
  });

  /**
   * GET /auth/status
   * Check current authentication status
   */
  router.get('/status', (req: Request, res: Response): void => {
    console.log(`[AUTH_STATUS] Checking status. Session ID: ${req.sessionID}`);
    const sess = req.session as any;
    console.log('[AUTH_STATUS] Session data:', {
      stravaAthleteId: sess.stravaAthleteId,
      athleteName: sess.athleteName
    });

    try {
      const athleteId = sess.stravaAthleteId;
      if (!athleteId) {
        console.log('[AUTH_STATUS] No session found - not authenticated');
        res.json({
          authenticated: false,
          participant: null,
          is_admin: false
        });
        return;
      }

      // Use LoginService to get full auth status
      const status = loginService.getAuthStatus(athleteId);
      console.log('[AUTH_STATUS] Auth status:', status);
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
    const sess = req.session as any;
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
