/**
 * routes/segments.js
 * 
 * Segment management endpoints
 * Admin: GET list, POST create/update, GET validate from Strava
 */

const express = require('express');
const router = express.Router();

module.exports = (services, middleware) => {
  const { db, getValidAccessToken, stravaClient } = middleware;
  const { requireAdmin } = middleware;

  /**
   * GET /admin/segments
   * Get all known segments (admin only)
   */
  router.get('/', requireAdmin, (req, res) => {
    try {
      const segments = db.prepare(`
        SELECT 
          strava_segment_id as id,
          strava_segment_id,
          name,
          distance,
          average_grade,
          city,
          state,
          country
        FROM segment ORDER BY name
      `).all();
      
      res.json(segments);
    } catch (error) {
      console.error('Failed to get segments:', error);
      res.status(500).json({ 
        error: 'Failed to fetch segments',
        details: error.message
      });
    }
  });

  /**
   * POST /admin/segments
   * Create or update a segment in our database (admin only)
   */
  router.post('/', requireAdmin, (req, res) => {
    const { strava_segment_id, name, distance, average_grade, city, state, country } = req.body || {};

    if (!strava_segment_id || !name) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['strava_segment_id', 'name']
      });
    }

    try {
      // Upsert segment by Strava ID with metadata
      db.prepare(`
        INSERT INTO segment (strava_segment_id, name, distance, average_grade, city, state, country)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(strava_segment_id) DO UPDATE SET 
          name = excluded.name,
          distance = excluded.distance,
          average_grade = excluded.average_grade,
          city = excluded.city,
          state = excluded.state,
          country = excluded.country
      `).run(strava_segment_id, name, distance, average_grade, city, state, country);

      const saved = db.prepare(`
        SELECT strava_segment_id as id, strava_segment_id, name, distance, average_grade, city, state, country
        FROM segment WHERE strava_segment_id = ?
      `).get(strava_segment_id);

      return res.status(201).json(saved);
    } catch (error) {
      console.error('Failed to upsert segment:', error);
      return res.status(500).json({ error: 'Failed to save segment', details: error.message });
    }
  });

  /**
   * GET /admin/segments/:id/validate
   * Validate segment from Strava API and fetch metadata (admin only)
   */
  router.get('/:id/validate', requireAdmin, async (req, res) => {
    const segmentId = req.params.id;
    
    try {
      // Get any connected participant's token to query Strava API
      const tokenRecord = db.prepare(`
        SELECT access_token, strava_athlete_id FROM participant_token LIMIT 1
      `).get();
      
      if (!tokenRecord) {
        return res.status(400).json({ 
          error: 'No connected participants available to validate segment' 
        });
      }
      
      const accessToken = await getValidAccessToken(db, stravaClient, tokenRecord.strava_athlete_id);
      
      // Try to fetch segment details from Strava using stravaClient
      const segment = await stravaClient.getSegment(segmentId, accessToken);
      
      res.json({
        id: segment.id,
        name: segment.name,
        distance: segment.distance,
        average_grade: segment.average_grade,
        city: segment.city,
        state: segment.state,
        country: segment.country
      });
    } catch (error) {
      console.error('Segment validation error:', error);
      if (error.statusCode === 404) {
        res.status(404).json({ error: 'Segment not found on Strava' });
      } else {
        res.status(500).json({ 
          error: 'Failed to validate segment',
          details: error.message
        });
      }
    }
  });

  return router;
};
