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
  router.get('/', requireAdmin, (_req: Request, res: Response): void => {
    try {
      const segments = db.prepare('SELECT * FROM segment ORDER BY name ASC').all();
      res.json(segments);
    } catch (error) {
      console.error('Error getting segments:', error);
      res.status(500).json({ error: 'Failed to get segments' });
    }
  });

  /**
   * POST /
   * Create new segment
   * Admin only
   */
  router.post('/', requireAdmin, (req: Request, res: Response): void => {
    try {
      const { name, strava_segment_id, distance, average_grade, city, state, country } =
        req.body as {
          name?: string;
          strava_segment_id?: number;
          distance?: number;
          average_grade?: number;
          city?: string;
          state?: string;
          country?: string;
        };

      if (!name || !strava_segment_id) {
        res.status(400).json({ error: 'Missing required fields: name, strava_segment_id' });
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

      const segment = db.prepare('SELECT * FROM segment WHERE strava_segment_id = ?').get(strava_segment_id);
      res.status(201).json(segment);
    } catch (error) {
      console.error('Error creating segment:', error);
      res.status(500).json({ error: 'Failed to create segment' });
    }
  });

  /**
   * GET /:id/validate
   * Validate segment from Strava API
   * Admin only
   * Returns segment metadata if valid
   */
  router.get('/:id/validate', requireAdmin, async (req: Request, res: Response): Promise<void> => {
    try {
      const segmentId = Number(req.params.id);

      // Get a participant with a valid token
      const participantWithToken = db
        .prepare(`
          SELECT p.strava_athlete_id 
          FROM participant p
          JOIN participant_token pt ON p.strava_athlete_id = pt.strava_athlete_id
          LIMIT 1
        `)
        .get();

      if (!participantWithToken) {
        res.status(400).json({
          error: 'No connected participants - cannot validate segments. Ask a participant to connect.'
        });
        return;
      }

      const { getValidAccessToken } = middleware;
      const accessToken = await getValidAccessToken((participantWithToken as any).strava_athlete_id);

      // Fetch segment from Strava
      const response = await fetch(`https://www.strava.com/api/v3/segments/${segmentId}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!response.ok) {
        res.status(404).json({ error: 'Segment not found on Strava' });
        return;
      }

      const segment = (await response.json()) as Record<string, unknown>;

      res.json({
        id: segmentId,
        name: segment.name,
        distance: segment.distance_meters,
        average_grade: segment.average_grade,
        city: (segment.city as string) || '',
        state: (segment.state as string) || '',
        country: (segment.country as string) || ''
      });
    } catch (error) {
      console.error('Error validating segment:', error);
      res.status(500).json({ error: 'Failed to validate segment' });
    }
  });

  return router;
};
