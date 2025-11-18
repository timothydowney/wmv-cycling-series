/**
 * routes/participants.js
 * 
 * Participant management endpoints
 * Public: GET list (basic info)
 * Admin: GET list with connection status
 */

const express = require('express');
const router = express.Router();

module.exports = (services, middleware) => {
  const { participantService } = services;
  const { requireAdmin } = middleware;

  /**
   * GET /admin/participants
   * Get all participants with connection status (admin only)
   */
  router.get('/', requireAdmin, (req, res) => {
    try {
      const participants = participantService.getAllParticipantsWithStatus();
      res.json(participants);
    } catch (error) {
      console.error('Failed to get participants:', error);
      res.status(500).json({ 
        error: 'Failed to fetch participants',
        details: error.message
      });
    }
  });

  return router;
};
