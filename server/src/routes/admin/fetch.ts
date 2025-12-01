import express from 'express';
import { db } from '../../db';
import BatchFetchService from '../../services/BatchFetchService';
import * as stravaClient from '../../stravaClient';
import { getValidAccessToken } from '../../tokenManager';
import { AuthorizationService } from '../../services/AuthorizationService';
import { getAdminAthleteIds } from '../../index';

const router = express.Router();

// Initialize services
const authorizationService = new AuthorizationService(getAdminAthleteIds);
const requireAdmin = authorizationService.createRequireAdminMiddleware();

const batchFetchService = new BatchFetchService(
  db,
  (database, athleteId) => getValidAccessToken(database, stravaClient, athleteId)
);

/**
 * POST /admin/weeks/:id/fetch-results
 * Trigger a batch fetch for a specific week
 * Returns Server-Sent Events (SSE) with progress updates
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
  
  // Send initial connection established event
  res.write(`data: ${JSON.stringify({ type: 'connected' })}` + String.fromCharCode(10) + String.fromCharCode(10));

  try {
    const result = await batchFetchService.fetchWeekResults(weekId, (logEntry) => {
      // Stream log entries to client
      res.write(`data: ${JSON.stringify({ type: 'log', data: logEntry })}` + String.fromCharCode(10) + String.fromCharCode(10));
    });

    // Send completion event
    res.write(`data: ${JSON.stringify({ type: 'complete', data: result })}` + String.fromCharCode(10) + String.fromCharCode(10));
    res.end();
  } catch (error: any) {
    console.error('Fetch error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message || 'Unknown error' })}` + String.fromCharCode(10) + String.fromCharCode(10));
    res.end();
  }
});

export default router;
