/**
 * routes/fallback.ts
 *
 * SPA fallback route
 * - Catch-all route to serve index.html for client-side routing
 */

import { Router, Request, Response } from 'express';
import path from 'path';

export default (): Router => {
  const router = Router();

  /**
   * GET *
   * Catch-all route for SPA - serve index.html
   * This allows client-side routing to work
   */
  router.get('*', (_req: Request, res: Response): void => {
    const indexPath = path.join(process.cwd(), 'dist', 'index.html');
    res.sendFile(indexPath);
  });

  return router;
};
