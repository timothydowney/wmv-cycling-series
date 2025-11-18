/**
 * routes/weeks.js
 * 
 * Week management endpoints
 * Public: GET list, GET by id, GET leaderboard, GET activities, GET segment efforts
 * Admin: POST create, PUT update, DELETE delete, POST fetch-results (batch)
 */

const express = require('express');
const router = express.Router();

module.exports = (services, middleware) => {
  const { weekService, batchFetchService } = services;
  const { requireAdmin } = middleware;

  /**
   * GET /weeks
   * Get all weeks for a season
   * Query params: season_id (required)
   */
  router.get('/', (req, res) => {
    const seasonId = parseInt(req.query.season_id, 10);
    
    // season_id is required - UI is responsible for managing season state
    if (!seasonId || isNaN(seasonId)) {
      return res.status(400).json({ error: 'season_id query parameter is required' });
    }
    
    try {
      const weeks = weekService.getAllWeeks(seasonId);
      res.json(weeks);
    } catch (error) {
      console.error('Failed to get weeks:', error);
      res.status(500).json({ error: 'Failed to get weeks', details: error.message });
    }
  });

  /**
   * GET /weeks/:id
   * Get a specific week by id
   */
  router.get('/:id', (req, res) => {
    const weekId = parseInt(req.params.id, 10);
    
    try {
      const week = weekService.getWeekById(weekId);
      res.json(week);
    } catch (error) {
      if (error.message === 'Week not found') {
        return res.status(404).json({ error: 'Week not found' });
      }
      console.error('Failed to get week:', error);
      res.status(500).json({ error: 'Failed to get week', details: error.message });
    }
  });

  /**
   * GET /weeks/:id/leaderboard
   * Get week leaderboard with rankings and results
   */
  router.get('/:id/leaderboard', (req, res) => {
    const weekId = parseInt(req.params.id, 10);
    
    try {
      const result = weekService.getWeekLeaderboard(weekId);
      res.json(result);
    } catch (error) {
      if (error.message === 'Week not found') {
        return res.status(404).json({ error: 'Week not found' });
      }
      console.error('Failed to get week leaderboard:', error);
      res.status(500).json({ error: 'Failed to get week leaderboard', details: error.message });
    }
  });

  /**
   * POST /admin/weeks
   * Create a new week (admin only)
   */
  router.post('/', requireAdmin, (req, res) => {
    try {
      const newWeek = weekService.createWeek(req.body);
      res.status(201).json(newWeek);
    } catch (error) {
      console.error('Failed to create week:', error);
      res.status(400).json({ error: 'Failed to create week', details: error.message });
    }
  });

  /**
   * PUT /admin/weeks/:id
   * Update an existing week (admin only)
   */
  router.put('/:id', requireAdmin, (req, res) => {
    const weekId = parseInt(req.params.id, 10);

    try {
      const updatedWeek = weekService.updateWeek(weekId, req.body);
      res.json(updatedWeek);
    } catch (error) {
      if (error.message === 'Week not found') {
        return res.status(404).json({ error: 'Week not found' });
      }
      if (error.message === 'No fields to update' || error.message === 'Invalid season_id' || error.message.includes('Invalid segment_id')) {
        return res.status(400).json({ error: error.message });
      }
      console.error('Failed to update week:', error);
      res.status(400).json({ error: 'Failed to update week', details: error.message });
    }
  });

  /**
   * DELETE /admin/weeks/:id
   * Delete a week and cascade delete activities, efforts, results (admin only)
   */
  router.delete('/:id', requireAdmin, (req, res) => {
    const weekId = parseInt(req.params.id, 10);

    try {
      const result = weekService.deleteWeek(weekId);
      res.json(result);
    } catch (error) {
      if (error.message === 'Week not found') {
        return res.status(404).json({ error: 'Week not found' });
      }
      console.error('Failed to delete week:', error);
      res.status(500).json({ error: 'Failed to delete week', details: error.message });
    }
  });

  /**
   * POST /admin/weeks/:id/fetch-results
   * Batch fetch results for a week from Strava (admin only)
   */
  router.post('/:id/fetch-results', requireAdmin, async (req, res) => {
    const weekId = parseInt(req.params.id, 10);
    
    try {
      // Use BatchFetchService to fetch and store results
      const summary = await batchFetchService.fetchWeekResults(weekId);
      
      res.json(summary);
    } catch (error) {
      console.error('Batch fetch error:', error);
      
      // Check if it's a "Week not found" error
      if (error.message === 'Week not found') {
        return res.status(404).json({ 
          error: 'Week not found'
        });
      }
      
      res.status(500).json({ 
        error: 'Failed to fetch results',
        details: error.message
      });
    }
  });

  return router;
};
