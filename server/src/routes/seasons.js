/**
 * routes/seasons.js
 * 
 * Season management endpoints
 * Public: GET list, GET by id, GET leaderboard
 * Admin: POST create, PUT update, DELETE delete
 */

const express = require('express');
const router = express.Router();

module.exports = (services, middleware) => {
  const { seasonService } = services;
  const { requireAdmin } = middleware;

  /**
   * GET /seasons
   * Get all seasons
   */
  router.get('/', (req, res) => {
    try {
      const seasons = seasonService.getAllSeasons();
      res.json(seasons);
    } catch (error) {
      console.error('Failed to get seasons:', error);
      res.status(500).json({ error: 'Failed to get seasons', details: error.message });
    }
  });

  /**
   * GET /seasons/:id
   * Get season by id
   */
  router.get('/:id', (req, res) => {
    const seasonId = parseInt(req.params.id, 10);
    try {
      const season = seasonService.getSeasonById(seasonId);
      res.json(season);
    } catch (error) {
      if (error.message === 'Season not found') {
        return res.status(404).json({ error: 'Season not found' });
      }
      console.error('Failed to get season:', error);
      res.status(500).json({ error: 'Failed to get season', details: error.message });
    }
  });

  /**
   * GET /seasons/:id/leaderboard
   * Get season leaderboard
   */
  router.get('/:id/leaderboard', (req, res) => {
    const seasonId = parseInt(req.params.id, 10);
    try {
      const result = seasonService.getSeasonLeaderboard(seasonId);
      res.json(result);
    } catch (error) {
      if (error.message === 'Season not found') {
        return res.status(404).json({ error: 'Season not found' });
      }
      console.error('Failed to get season leaderboard:', error);
      res.status(500).json({ error: 'Failed to get season leaderboard', details: error.message });
    }
  });

  /**
   * POST /admin/seasons
   * Create a new season (admin only)
   */
  router.post('/', requireAdmin, (req, res) => {
    try {
      const newSeason = seasonService.createSeason(req.body);
      res.status(201).json(newSeason);
    } catch (error) {
      console.error('Failed to create season:', error);
      res.status(400).json({ error: 'Failed to create season', details: error.message });
    }
  });

  /**
   * PUT /admin/seasons/:id
   * Update an existing season (admin only)
   */
  router.put('/:id', requireAdmin, (req, res) => {
    const seasonId = parseInt(req.params.id, 10);
    try {
      const updatedSeason = seasonService.updateSeason(seasonId, req.body);
      res.json(updatedSeason);
    } catch (error) {
      if (error.message === 'Season not found') {
        return res.status(404).json({ error: 'Season not found' });
      }
      if (error.message === 'No fields to update') {
        return res.status(400).json({ error: 'No fields to update' });
      }
      console.error('Failed to update season:', error);
      res.status(400).json({ error: 'Failed to update season', details: error.message });
    }
  });

  /**
   * DELETE /admin/seasons/:id
   * Delete a season (admin only)
   */
  router.delete('/:id', requireAdmin, (req, res) => {
    const seasonId = parseInt(req.params.id, 10);
    try {
      const result = seasonService.deleteSeason(seasonId);
      res.json(result);
    } catch (error) {
      if (error.message === 'Season not found') {
        return res.status(404).json({ error: 'Season not found' });
      }
      if (error.message.includes('Cannot delete season with existing weeks')) {
        const match = error.message.match(/(\d+)\s+week/);
        const weekCount = match ? parseInt(match[1], 10) : 0;
        return res.status(400).json({ error: error.message, weeks_count: weekCount });
      }
      console.error('Failed to delete season:', error);
      res.status(500).json({ error: 'Failed to delete season', details: error.message });
    }
  });

  return router;
};
