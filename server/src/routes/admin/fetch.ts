import express from 'express';
import { Database } from 'better-sqlite3';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import BatchFetchService from '../../services/BatchFetchService';
import { SegmentService } from '../../services/SegmentService';
import * as stravaClient from '../../stravaClient';
import { getValidAccessToken } from '../../tokenManager';
import { AuthorizationService } from '../../services/AuthorizationService';
import { config } from '../../config';
import WeekService from '../../services/WeekService';

export function createFetchRouter(sqliteDb: Database, drizzleDb: BetterSQLite3Database) {
  const router = express.Router();

  // Initialize services
  const authorizationService = new AuthorizationService(() => config.adminAthleteIds);
  const requireAdmin = authorizationService.createRequireAdminMiddleware();
  const weekService = new WeekService(drizzleDb);

  const batchFetchService = new BatchFetchService(
    sqliteDb,
    (database, athleteId, forceRefresh) => getValidAccessToken(database, stravaClient, athleteId, forceRefresh)
  );

  /**
   * POST /admin/weeks/:id/fetch-results
   * Trigger a batch fetch for a specific week
   * Streams progress via Server-Sent Events (SSE)
   * Also refreshes segment metadata before fetching
   * Admin only
   */
  router.post('/weeks/:id/fetch-results', requireAdmin as any, async (req, res) => {
    const weekId = parseInt(req.params.id, 10);
    if (isNaN(weekId)) {
      res.status(400).json({ error: 'Invalid week ID' });
      return;
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      // Get week details first (now with proper drizzle database type)
      let week;
      try {
        week = await weekService.getWeekById(weekId);
      } catch {
        res.status(404).json({ error: 'Week not found' });
        return;
      }

      // Helper to send SSE log event (matches FetchLogEntry interface)
      const sendLog = (
        level: 'info' | 'success' | 'error' | 'section',
        message: string,
        participant?: string,
        effortLinks?: any[]
      ) => {
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
      const segmentService = new SegmentService(drizzleDb);
      const adminAthleteId = (req.session as any)?.stravaAthleteId;
      await segmentService.fetchAndStoreSegmentMetadata(
        week.strava_segment_id,
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
        },
        adminAthleteId // Prefer admin's token, not random participant
      );

      // Execute batch fetch with logging callback
      const result = await batchFetchService.fetchWeekResults(weekId, sendLog);

      // Send completion event with structured result (matches original format)
      res.write('event: complete\n');
      res.write(
        `data: ${JSON.stringify({
          message: 'Results fetched successfully',
          week_id: weekId,
          participants_processed: result.participants_processed,
          results_found: result.results_found,
          summary: result.summary
        })}\n\n`
      );

      res.end();
    } catch (error: any) {
      console.error('Fetch error:', error);
      res.write('event: error\n');
      res.write(
        `data: ${JSON.stringify({
          error: error.message || 'Unknown error'
        })}\n\n`
      );
      res.end();
    }
  });

  return router;
}
