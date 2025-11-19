/**
 * routes/participants.ts
 *
 * Participant management routes
 * - List all participants with connection status
 */

import { Router, Request, Response } from 'express';
import type ParticipantService from '../services/ParticipantService';

interface ParticipantServices {
  participantService: ParticipantService;
}

interface ParticipantMiddleware {
  requireAdmin: (req: Request, res: Response, next: () => void) => void;
}

export default (services: ParticipantServices, middleware: ParticipantMiddleware): Router => {
  const { participantService } = services;
  const { requireAdmin } = middleware;
  const router = Router();

  /**
   * GET /
   * List all participants with connection status
   * Admin only
   */
  router.get('/', requireAdmin, (_req: Request, res: Response): void => {
    try {
      const participants = participantService.getAllParticipantsWithStatus();
      res.json(participants);
    } catch (error) {
      console.error('Error getting participants:', error);
      res.status(500).json({ error: 'Failed to get participants' });
    }
  });

  return router;
};
