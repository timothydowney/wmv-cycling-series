/**
 * routes/fallback.js
 * 
 * SPA fallback route
 * Serve index.html for any unmatched routes (enables client-side routing)
 */

const express = require('express');
const path = require('path');
const router = express.Router();

module.exports = () => {
  /**
   * GET * (catch-all)
   * Serve SPA index.html for client-side routing
   */
  router.get('*', (req, res) => {
    // Serve the SPA index.html which enables client-side routing
    const indexPath = path.join(__dirname, '..', '..', '..', 'dist', 'index.html');
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error('Error serving index.html:', err);
        res.status(500).json({ error: 'Failed to serve application' });
      }
    });
  });

  return router;
};
