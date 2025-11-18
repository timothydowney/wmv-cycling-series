/**
 * routes/public.js
 * 
 * Public endpoints (no authentication required)
 * - Health check
 * - List all participants (public info)
 * - List all segments
 */

const express = require('express');
const router = express.Router();

module.exports = (services, helpers) => {
  const { participantService } = services;
  const { db } = helpers;

  /**
   * GET /health
   * Health check endpoint
   */
  router.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  /**
   * GET /participants
   * List all participants with basic info (public endpoint)
   */
  router.get('/participants', (req, res) => {
    try {
      const participants = participantService.getAllParticipants();
      res.json(participants);
    } catch (error) {
      console.error('Failed to get participants:', error);
      res.status(500).json({ error: 'Failed to get participants', details: error.message });
    }
  });

  /**
   * GET /segments
   * List all known segments (public endpoint)
   */
  router.get('/segments', (req, res) => {
    const rows = db.prepare('SELECT strava_segment_id, name FROM segment').all();
    res.json(rows);
  });

  return router;
};
