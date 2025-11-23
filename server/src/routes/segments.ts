/**
 * routes/segments.ts
 *
 * Segment management routes
 * - List all segments
 * - Create new segment
 * - Validate segment from Strava API
 */

import { Router, Request, Response } from 'express';
import type { Database } from 'better-sqlite3';
import { SegmentService } from '../services/SegmentService';
import type { CreateSegmentRequest } from '../types/requests';
import type { SegmentRow } from '../types/database';

interface SegmentServices {
  // Services (if any needed in future)
}

interface SegmentMiddleware {
  db: Database;
  getValidAccessToken: (athleteId: number) => Promise<string>;
  requireAdmin: (req: Request, res: Response, next: () => void) => void;
}

export default (
  _services: SegmentServices,
  middleware: SegmentMiddleware
): Router => {
  const { db, requireAdmin } = middleware;
  const router = Router();

  /**
   * GET /
   * List all stored segments
   * Admin only
   */
  router.get('/', requireAdmin, (_req: Request, res: Response<SegmentRow[]>): void => {
    try {
      const segments = db.prepare('SELECT * FROM segment ORDER BY name ASC').all() as SegmentRow[];
      res.json(segments);
    } catch (error) {
      console.error('Error getting segments:', error);
      res.status(500).json({ error: 'Failed to get segments' } as any);
    }
  });

  /**
   * POST /
   * Create new segment
   * Admin only
   */
  router.post('/', requireAdmin, (req: Request, res: Response<SegmentRow>): void => {
    try {
      const body = req.body as CreateSegmentRequest;
      const { name, strava_segment_id, distance, average_grade, city, state, country } = body;

      if (!name || !strava_segment_id) {
        res.status(400).json({ error: 'Missing required fields: name, strava_segment_id' } as any);
        return;
      }

      db
        .prepare(
          `INSERT INTO segment (name, strava_segment_id, distance, average_grade, city, state, country)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(strava_segment_id) DO UPDATE SET
         name = excluded.name,
         distance = excluded.distance,
         average_grade = excluded.average_grade,
         city = excluded.city,
         state = excluded.state,
         country = excluded.country`
        )
        .run(name, strava_segment_id, distance, average_grade, city, state, country);

      const segment = db.prepare('SELECT * FROM segment WHERE strava_segment_id = ?').get(strava_segment_id) as SegmentRow;
      res.status(201).json(segment);
    } catch (error) {
      console.error('Error creating segment:', error);
      res.status(500).json({ error: 'Failed to create segment' } as any);
    }
  });

  /**
   * GET /:id/validate
   * Validate segment from Strava API and store metadata
   * Admin only
   * Returns segment metadata if valid, stores in database
   */
  router.get('/:id/validate', requireAdmin, async (req: Request, res: Response<SegmentRow>): Promise<void> => {
    try {
      const segmentId = Number(req.params.id);

      // Check if we have any connected participants for token access
      const hasConnectedParticipants = !!db.prepare('SELECT 1 FROM participant_token LIMIT 1').get();

      if (!hasConnectedParticipants) {
        res.status(400).json({
          error: 'No connected participants - cannot validate segments. Ask a participant to connect.'
        } as any);
        return;
      }

      // Use SegmentService to fetch and store metadata atomically
      const segmentService = new SegmentService(db);
      const result = await segmentService.fetchAndStoreSegmentMetadata(
        segmentId,
        'segment-validation'
      );

      if (!result) {
        res.status(500).json({ error: 'Failed to store segment metadata' } as any);
        return;
      }

      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Segment Validation] ✗ Error validating segment: ${message}`);
      res.status(500).json({ error: `Failed to validate segment: ${message}` } as any);
    }
  });

  return router;
};
