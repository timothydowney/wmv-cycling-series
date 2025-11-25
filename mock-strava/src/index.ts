import * as http from 'http';
import { URL } from 'url';
import { createLogger } from './logger.js';
import { SubscriptionStore } from './subscriptionStore.js';
import { RequestHandlers } from './handlers.js';

const PORT = parseInt(process.env.MOCK_STRAVA_PORT || '4000', 10);

const logger = createLogger();
const store = new SubscriptionStore(logger);
const handlers = new RequestHandlers(logger, store);

// Parse body helper
async function getBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

// Parse query string helper
function parseQuery(queryString: string): Record<string, string> {
  const params: Record<string, string> = {};
  const searchParams = new URLSearchParams(queryString);
  searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

const server = http.createServer(async (req, res) => {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const query = parseQuery(url.search.substring(1));

  logger.debug(`${req.method} ${pathname}`, { query });

  try {
    // Health check
    if (pathname === '/health' && req.method === 'GET') {
      handlers.handleHealth(req, res);
      return;
    }

    // Push subscriptions endpoints
    if (pathname === '/api/v3/push_subscriptions') {
      if (req.method === 'POST') {
        const body = await getBody(req);
        await handlers.handleCreateSubscription(req, res, body);
      } else if (req.method === 'GET') {
        await handlers.handleListSubscriptions(req, res, query);
      } else {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
      }
      return;
    }

    // Delete subscription
    const deleteMatch = pathname.match(/^\/api\/v3\/push_subscriptions\/(\d+)$/);
    if (deleteMatch && req.method === 'DELETE') {
      const subscriptionId = parseInt(deleteMatch[1], 10);
      await handlers.handleDeleteSubscription(req, res, subscriptionId);
      return;
    }

    // Not found
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  } catch (error) {
    logger.error('Unhandled error', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  logger.info(`Mock Strava server listening`, {
    url: `http://localhost:${PORT}`,
    health: `http://localhost:${PORT}/health`,
  });
});

// Prevent unhandled rejections
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', reason);
});
