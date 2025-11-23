/**
 * routes/seasons.ts
 *
 * Season management routes
 * - List all seasons
 * - Get season by ID
 * - Get season leaderboard
 * - Create new season
 * - Update season
 * - Delete season
 */

import { Router, Request, Response } from 'express';
import type SeasonService from '../services/SeasonService';
import type { CreateSeasonRequest, UpdateSeasonRequest } from '../types/requests';

interface SeasonServices {
  seasonService: SeasonService;
}

interface SeasonMiddleware {
  requireAdmin: (req: Request, res: Response, next: () => void) => void;
}

export default (services: SeasonServices, middleware: SeasonMiddleware): Router => {
  const { seasonService } = services;
  const { requireAdmin } = middleware;
  const router = Router();

  /**
   * GET /
   * List all seasons
   */
  router.get('/', (_req: Request, res: Response): void => {
    try {
      const seasons = seasonService.getAllSeasons();
      res.json(seasons);
    } catch (error) {
      console.error('Error getting seasons:', error);
      res.status(500).json({ error: 'Failed to get seasons' });
    }
  });

  /**
   * GET /:id
   * Get season by ID
   */
  router.get('/:id', (req: Request, res: Response): void => {
    try {
      const season = seasonService.getSeasonById(Number(req.params.id));
      res.json(season);
    } catch (error) {
      if (error instanceof Error && error.message === 'Season not found') {
        res.status(404).json({ error: 'Season not found' });
        return;
      }
      console.error('Error getting season:', error);
      res.status(500).json({ error: 'Failed to get season' });
    }
  });

  /**
   * GET /:id/leaderboard
   * Get season leaderboard
   */
  router.get('/:id/leaderboard', async (req: Request, res: Response): Promise<void> => {
    try {
      const seasonId = Number(req.params.id);
      const season = seasonService.getSeasonById(seasonId);
      if (!season) {
        res.status(404).json({ error: 'Season not found' });
        return;
      }
      const leaderboard = await seasonService.getSeasonLeaderboard(seasonId);
      res.json(leaderboard);
    } catch (error) {
      console.error('Error getting season leaderboard:', error);
      res.status(500).json({ error: 'Failed to get season leaderboard' });
    }
  });

  /**
   * POST /
   * Create new season
   * Admin only
   */
  router.post('/', requireAdmin, (req: Request, res: Response): void => {
    try {
      const body = req.body as CreateSeasonRequest;
      const { name, start_at, end_at, is_active } = body;

      if (!name || start_at === undefined || end_at === undefined) {
        res.status(400).json({ error: 'Missing required fields: name, start_at, end_at' });
        return;
      }

      const season = seasonService.createSeason({ name, start_at, end_at, is_active });
      res.status(201).json(season);
    } catch (error) {
      console.error('Error creating season:', error);
      res.status(500).json({ error: 'Failed to create season' });
    }
  });

  /**
   * PUT /:id
   * Update season
   * Admin only
   */
  router.put('/:id', requireAdmin, (req: Request, res: Response): void => {
    try {
      const body = req.body as UpdateSeasonRequest;
      const { name, start_at, end_at, is_active } = body;

      const season = seasonService.updateSeason(Number(req.params.id), {
        name,
        start_at,
        end_at,
        is_active
      });

      res.json(season);
    } catch (error) {
      if (error instanceof Error && error.message === 'Season not found') {
        res.status(404).json({ error: 'Season not found' });
        return;
      }
      console.error('Error updating season:', error);
      res.status(500).json({ error: 'Failed to update season' });
    }
  });

  /**
   * DELETE /:id
   * Delete season
   * Admin only
   */
  router.delete('/:id', requireAdmin, (req: Request, res: Response): void => {
    try {
      const seasonId = Number(req.params.id);
      seasonService.deleteSeason(seasonId);
      res.json({ message: 'Season deleted successfully', seasonId: seasonId });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Season not found') {
          res.status(404).json({ error: 'Season not found' });
          return;
        }
        if (error.message.includes('Cannot delete season with existing weeks')) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      console.error('Error deleting season:', error);
      res.status(500).json({ error: 'Failed to delete season' });
    }
  });

  return router;
};
