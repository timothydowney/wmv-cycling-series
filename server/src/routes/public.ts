/**
 * routes/public.ts
 *
 * Public routes (no auth required)
 * - Health check endpoint
 */

import { Router, Request, Response } from 'express';

export default (): Router => {
  const router = Router();

  /**
   * GET /health
   * Health check endpoint
   */
  router.get('/health', (_req: Request, res: Response): void => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return router;
};
