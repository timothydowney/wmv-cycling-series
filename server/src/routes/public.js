/**
 * routes/public.js
 * 
 * Public endpoints (no authentication required)
 * - Health check
 */

const express = require('express');
const router = express.Router();

module.exports = () => {
  /**
   * GET /health
   * Health check endpoint
   */
  router.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  return router;
};
