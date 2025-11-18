/**
 * routes/userData.js
 * 
 * GDPR and user data management
 * - Request complete user data deletion
 * - Access all personal data (GDPR compliance)
 */

const express = require('express');
const router = express.Router();

module.exports = (services) => {
  const { userDataService } = services;

  /**
   * POST /user/data/delete
   * Request complete deletion of user data (GDPR compliance)
   * User must be authenticated
   * Deletion completes within 48 hours
   */
  router.post('/delete', (req, res) => {
    // Require authentication
    if (!req.session.stravaAthleteId) {
      return res.status(401).json({ error: 'Not authenticated. Please connect to Strava first.' });
    }

    const stravaAthleteId = req.session.stravaAthleteId;

    try {
      const result = userDataService.deleteUserData(stravaAthleteId);

      // Destroy session after data deletion
      req.session.destroy((err) => {
        if (err) {
          console.warn('[USER_DATA] Session destruction error during data deletion:', err);
        }
      });

      res.json(result);
    } catch (error) {
      console.error('[USER_DATA] Error during data deletion:', error);
      res.status(500).json({
        error: 'Failed to delete data',
        message: error.message || 'An unexpected error occurred',
        contact: 'Please contact admins@westmassvel.org if the problem persists'
      });
    }
  });

  /**
   * GET /user/data
   * Retrieve all personal data we hold about the user (GDPR Data Access)
   * User must be authenticated
   */
  router.get('/', (req, res) => {
    if (!req.session.stravaAthleteId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const stravaAthleteId = req.session.stravaAthleteId;

    try {
      const data = userDataService.getUserData(stravaAthleteId);
      res.json(data);
    } catch (error) {
      if (error.message === 'Participant not found') {
        return res.status(404).json({ error: 'Participant not found' });
      }
      console.error('[USER_DATA] Error retrieving user data:', error);
      res.status(500).json({
        error: 'Failed to retrieve data',
        message: error.message
      });
    }
  });

  return router;
};
