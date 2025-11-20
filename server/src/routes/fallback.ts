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
    // Serve index.html from the compiled frontend build
    // __dirname is /app/server/dist (compiled location)
    // We need to go up to /app and then into dist
    const indexPath = path.join(__dirname, '../../dist', 'index.html');
    res.sendFile(indexPath);
  });

  return router;
};
