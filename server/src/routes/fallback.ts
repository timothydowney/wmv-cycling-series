/**
 * routes/fallback.ts
 *
 * SPA fallback route
 * - Catch-all route to serve index.html for client-side routing
 */

import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

export default (): Router => {
  const router = Router();

  /**
   * GET *
   * Catch-all route for SPA - serve index.html
   * This allows client-side routing to work
   */
  router.get('*', (_req: Request, res: Response): void => {
    // Serve index.html from the compiled frontend build
    // __dirname is /app/server/dist/routes (compiled location)
    // We need to go up to /app and then into dist
    const indexPath = path.resolve(__dirname, '../../../dist/index.html');
    
    // Only send the file if it exists
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      // If index.html doesn't exist, return 404 instead of trying to stat a non-existent file
      console.warn(`[SPA Fallback] index.html not found at: ${indexPath}`);
      res.status(404).json({ error: 'Frontend not built. Please run: npm run build' });
    }
  });

  return router;
};
