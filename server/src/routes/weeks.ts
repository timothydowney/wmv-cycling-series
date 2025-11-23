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
import { SegmentService } from '../services/SegmentService';
import { Database } from 'better-sqlite3';

interface WeekServices {
  weekService: WeekService;
  batchFetchService: BatchFetchService;
}

interface WeekMiddleware {
  requireAdmin: (req: Request, res: Response, next: () => void) => void;
}

export default (services: WeekServices, middleware: WeekMiddleware, database: Database): Router => {
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
  router.get('/:id/leaderboard', async (req: Request, res: Response): Promise<void> => {
    try {
      const weekId = Number(req.params.id);
      const week = weekService.getWeekById(weekId);
      if (!week) {
        res.status(404).json({ error: 'Week not found' });
        return;
      }
      const leaderboard = await weekService.getWeekLeaderboard(weekId);
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
   * Also fetches segment metadata from Strava and caches it
   */
  router.post('/', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        season_id,
        week_name,
        segment_id,
        segment_name,
        required_laps,
        start_at,
        end_at,
        notes
      } = req.body as {
        season_id?: number;
        week_name?: string;
        segment_id?: number;
        segment_name?: string;
        required_laps?: number;
        start_at?: number;
        end_at?: number;
        notes?: string;
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
        end_at,
        notes
      });

      // Fetch segment metadata from Strava and cache it
      const segmentService = new SegmentService(database);
      await segmentService.fetchAndStoreSegmentMetadata(segment_id, 'week-create');

      res.status(201).json(week);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      
      // Validation errors return 400
      if (message.includes('Notes cannot exceed') || 
          message.includes('Invalid') ||
          message.includes('not found')) {
        res.status(400).json({ error: message });
        return;
      }
      
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
        end_time,
        notes
      } = req.body as {
        week_name?: string;
        segment_id?: number;
        segment_name?: string;
        required_laps?: number;
        start_at?: number;
        end_at?: number;
        start_time?: string;
        end_time?: string;
        notes?: string;
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
        end_at: convertedEndAt,
        notes
      });

      res.json(week);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      
      // Validation errors return 400
      if (message.includes('Notes cannot exceed') || 
          message === 'No fields to update' ||
          message.includes('Invalid')) {
        res.status(400).json({ error: message });
        return;
      }
      
      // Not found errors return 404
      if (message === 'Week not found') {
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
   * Also refreshes segment metadata for this week
   * Streams progress via Server-Sent Events (SSE)
   * Admin only
   */
  router.post('/:id/fetch-results', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const weekId = Number(req.params.id);

      // Get week details
      let week;
      try {
        week = weekService.getWeekById(weekId);
      } catch {
        res.status(404).json({ error: 'Week not found' });
        return;
      }

      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      // Note: Access-Control-Allow-Origin is handled by the global CORS middleware in index.ts
      // which correctly sets it based on CLIENT_BASE_URL and allows credentials

      // Helper to send SSE log event (matches LogCallback type)
      const sendLog = (level: 'info' | 'success' | 'error' | 'section', message: string, participant?: string, effortLinks?: any[]) => {
        const logEntry = {
          timestamp: Date.now(),
          level,
          message,
          ...(participant && { participant }),
          ...(effortLinks && effortLinks.length > 0 && { effortLinks })
        };
        res.write('event: log\n');
        res.write(`data: ${JSON.stringify(logEntry)}\n\n`);
      };

      // Refresh segment metadata before fetching results
      sendLog('section', `Refreshing segment metadata for: ${week.segment_name}`);
      const segmentService = new SegmentService(database);
      await segmentService.fetchAndStoreSegmentMetadata(
        week.segment_id,
        'fetch-results',
        (level: string, message: string) => {
          // Map service log levels to SSE levels
          if (level === 'error') {
            sendLog('error', message);
          } else if (level === 'success') {
            sendLog('success', message);
          } else if (level === 'warn') {
            sendLog('info', message);
          }
          // 'debug' and 'info' go only to console, not SSE
          console.log(message);
        }
      );

      // Execute batch fetch with logging callback
      const result = await batchFetchService.fetchWeekResults(weekId, sendLog);

      // Send completion event
      res.write('event: complete\n');
      res.write(`data: ${JSON.stringify({
        message: 'Results fetched successfully',
        week_id: weekId,
        participants_processed: result.participants_processed,
        results_found: result.results_found,
        summary: result.summary
      })}\n\n`);

      res.end();
    } catch (error) {
      console.error('Error fetching results:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.write('event: error\n');
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    }
  });

  return router;
};
