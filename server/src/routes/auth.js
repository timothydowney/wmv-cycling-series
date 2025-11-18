/**
 * routes/auth.js
 * 
 * OAuth authentication and session management routes
 * - Initiate OAuth flow with Strava
 * - Handle OAuth callback and token exchange
 * - Check authentication status
 * - Disconnect Strava account
 */

const express = require('express');
const router = express.Router();

module.exports = (services, helpers) => {
  const { loginService } = services;
  const { getBaseUrl, CLIENT_BASE_URL } = helpers;

  /**
   * GET /auth/strava
   * Initiate OAuth flow - redirect to Strava authorization endpoint
   */
  router.get('/strava', (req, res) => {
    // Compute redirect URI with safe fallback if env not set
    const computedRedirect = `${getBaseUrl(req)}/auth/strava/callback`;
    const redirectUri = process.env.STRAVA_REDIRECT_URI || computedRedirect;

    // Helpful runtime trace (does not log secrets)
    console.log('[AUTH] Using STRAVA_REDIRECT_URI:', redirectUri);
    console.log('[AUTH] Using CLIENT_BASE_URL:', CLIENT_BASE_URL || '(not set, will fallback)');

    const stravaAuthUrl = 'https://www.strava.com/oauth/authorize?' +
      new URLSearchParams({
        client_id: process.env.STRAVA_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        approval_prompt: 'auto',  // 'force' to always show consent screen
        scope: 'activity:read,profile:read_all'
      });

    console.log('Redirecting to Strava OAuth:', stravaAuthUrl);
    res.redirect(stravaAuthUrl);
  });

  /**
   * GET /auth/strava/callback
   * Handle OAuth callback - exchange code for tokens and create session
   */
  router.get('/strava/callback', async (req, res) => {
    const { code, scope } = req.query;
    
    if (!code) {
      console.error('OAuth callback missing authorization code');
      return res.redirect(`${CLIENT_BASE_URL}?error=authorization_denied`);
    }
    
    try {
      // Use LoginService to exchange code and create session
      await loginService.exchangeCodeAndCreateSession(code, req.session, scope);
      
      const stravaAthleteId = req.session.stravaAthleteId;
      const athleteName = req.session.athleteName;
      
      // Explicitly save session before redirecting (important for some session stores)
      console.log(`[AUTH] Saving session for athlete ${stravaAthleteId}...`);
      console.log('[AUTH] Session data before save:', {
        stravaAthleteId,
        athleteName,
        sessionID: req.sessionID
      });
      
      req.session.save((err) => {
        if (err) {
          console.error('[AUTH] Session save error:', err);
          return res.redirect(`${CLIENT_BASE_URL}?error=session_error`);
        }
        
        console.log(`[AUTH] Session saved successfully for athlete ${stravaAthleteId}`);
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
  router.get('/status', (req, res) => {
    console.log(`[AUTH_STATUS] Checking status. Session ID: ${req.sessionID}`);
    console.log('[AUTH_STATUS] Session data:', {
      stravaAthleteId: req.session.stravaAthleteId,
      athleteName: req.session.athleteName
    });
    
    try {
      if (!req.session.stravaAthleteId) {
        console.log('[AUTH_STATUS] No session found - not authenticated');
        return res.json({
          authenticated: false,
          participant: null,
          is_admin: false
        });
      }
      
      // Use LoginService to get full auth status
      const status = loginService.getAuthStatus(req.session.stravaAthleteId);
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
  router.post('/disconnect', (req, res) => {
    if (!req.session.stravaAthleteId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const stravaAthleteId = req.session.stravaAthleteId;
    
    try {
      // Use LoginService to disconnect (delete tokens)
      loginService.disconnectStrava(stravaAthleteId);
      
      // Destroy session
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destruction error:', err);
          return res.status(500).json({ error: 'Failed to disconnect' });
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
