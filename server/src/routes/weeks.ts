/**
 * routes/weeks.ts
 *
 * Week management and activity collection routes
 * - List all weeks
 * - Get week by ID
 * - Get week leaderboard
 * - Create new week
 * - Update week
 * - Delete week
 * - Batch fetch activities and update results
 */

import { Router, Request, Response } from 'express';
import type WeekService from '../services/WeekService';
import type BatchFetchService from '../services/BatchFetchService';
import { isoToUnix } from '../dateUtils';

interface WeekServices {
  weekService: WeekService;
  batchFetchService: BatchFetchService;
}

interface WeekMiddleware {
  requireAdmin: (req: Request, res: Response, next: () => void) => void;
}

export default (services: WeekServices, middleware: WeekMiddleware): Router => {
  const { weekService, batchFetchService } = services;
  const { requireAdmin } = middleware;
  const router = Router();

  /**
   * GET /
   * List all weeks
   * Note: Requires seasonId query param to filter weeks by season
   */
  router.get('/', (req: Request, res: Response): void => {
    try {
      const seasonId = Number(req.query.season_id);
      if (!seasonId) {
        res.status(400).json({ error: 'season_id query parameter is required' });
        return;
      }
      const weeks = weekService.getAllWeeks(seasonId);
      res.json(weeks);
    } catch (error) {
      console.error('Error getting weeks:', error);
      res.status(500).json({ error: 'Failed to get weeks' });
    }
  });

  /**
   * GET /:id
   * Get week by ID
   */
  router.get('/:id', (req: Request, res: Response): void => {
    try {
      const week = weekService.getWeekById(Number(req.params.id));
      res.json(week);
    } catch (error) {
      if (error instanceof Error && error.message === 'Week not found') {
        res.status(404).json({ error: 'Week not found' });
        return;
      }
      console.error('Error getting week:', error);
      res.status(500).json({ error: 'Failed to get week' });
    }
  });

  /**
   * GET /:id/leaderboard
   * Get week leaderboard (on-read scoring)
   */
  router.get('/:id/leaderboard', (req: Request, res: Response): void => {
    try {
      const weekId = Number(req.params.id);
      const week = weekService.getWeekById(weekId);
      if (!week) {
        res.status(404).json({ error: 'Week not found' });
        return;
      }
      const leaderboard = weekService.getWeekLeaderboard(weekId);
      res.json(leaderboard);
    } catch (error) {
      if (error instanceof Error && error.message === 'Week not found') {
        res.status(404).json({ error: 'Week not found' });
        return;
      }
      console.error('Error getting week leaderboard:', error);
      res.status(500).json({ error: 'Failed to get week leaderboard' });
    }
  });

  /**
   * POST /
   * Create new week
   * Admin only
   */
  router.post('/', requireAdmin, (req: Request, res: Response): void => {
    try {
      const {
        season_id,
        week_name,
        segment_id,
        segment_name,
        required_laps,
        start_at,
        end_at
      } = req.body as {
        season_id?: number;
        week_name?: string;
        segment_id?: number;
        segment_name?: string;
        required_laps?: number;
        start_at?: number;
        end_at?: number;
      };

      if (!week_name || !segment_id) {
        res.status(400).json({
          error: 'Missing required fields: week_name, segment_id'
        });
        return;
      }

      const week = weekService.createWeek({
        season_id,
        week_name,
        segment_id,
        segment_name,
        required_laps: required_laps || 1,
        start_at,
        end_at
      });

      res.status(201).json(week);
    } catch (error) {
      console.error('Error creating week:', error);
      res.status(500).json({ error: 'Failed to create week' });
    }
  });

  /**
   * PUT /:id
   * Update week
   * Admin only
   */
  router.put('/:id', requireAdmin, (req: Request, res: Response): void => {
    try {
      const {
        week_name,
        segment_id,
        segment_name,
        required_laps,
        start_at,
        end_at,
        start_time,
        end_time
      } = req.body as {
        week_name?: string;
        segment_id?: number;
        segment_name?: string;
        required_laps?: number;
        start_at?: number;
        end_at?: number;
        start_time?: string;
        end_time?: string;
      };

      // Convert ISO strings to Unix if provided
      let convertedStartAt = start_at;
      let convertedEndAt = end_at;

      if (start_time) {
        const converted = isoToUnix(start_time);
        if (converted !== null) {
          convertedStartAt = converted;
        }
      }
      if (end_time) {
        const converted = isoToUnix(end_time);
        if (converted !== null) {
          convertedEndAt = converted;
        }
      }

      const week = weekService.updateWeek(Number(req.params.id), {
        week_name,
        segment_id,
        segment_name,
        required_laps,
        start_at: convertedStartAt,
        end_at: convertedEndAt
      });

      res.json(week);
    } catch (error) {
      if (error instanceof Error && error.message === 'No fields to update') {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }
      if (error instanceof Error && error.message === 'Week not found') {
        res.status(404).json({ error: 'Week not found' });
        return;
      }
      console.error('Error updating week:', error);
      res.status(500).json({ error: 'Failed to update week' });
    }
  });

  /**
   * DELETE /:id
   * Delete week (cascades to activities, efforts, results)
   * Admin only
   */
  router.delete('/:id', requireAdmin, (req: Request, res: Response): void => {
    try {
      const weekId = Number(req.params.id);
      weekService.deleteWeek(weekId);
      res.json({
        message: 'Week deleted successfully',
        weekId: weekId
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Week not found') {
        res.status(404).json({ error: 'Week not found' });
        return;
      }
      console.error('Error deleting week:', error);
      res.status(500).json({ error: 'Failed to delete week' });
    }
  });

  /**
   * POST /:id/fetch-results
   * Batch fetch activities for all connected participants for this week
   * Finds best qualifying activity and updates leaderboard
   * Admin only
   */
  router.post('/:id/fetch-results', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const weekId = Number(req.params.id);

      // Get week details
      try {
        weekService.getWeekById(weekId);
      } catch {
        res.status(404).json({ error: 'Week not found' });
        return;
      }

      // Execute batch fetch
      const result = await batchFetchService.fetchWeekResults(weekId);

      res.json({
        message: 'Results fetched successfully',
        week_id: weekId,
        participants_processed: result.participants_processed,
        results_found: result.results_found,
        summary: result.summary
      });
    } catch (error) {
      console.error('Error fetching results:', error);
      res.status(500).json({ error: 'Failed to fetch results' });
    }
  });

  return router;
};
