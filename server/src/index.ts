// Configuration must be imported FIRST (it loads .env and provides all config)
import { config, logConfigOnStartup, logEnvironmentVariables, isTestMode } from './config';

import express from 'express';
import cors from 'cors';
import path from 'path';

import { db, drizzleDb } from './db';
import * as trpcExpress from '@trpc/server/adapters/express';
import { createContext } from './trpc/context';
import { appRouter } from './routers';

import session from 'express-session';
import SqliteStore from 'better-sqlite3-session-store';
import strava from 'strava-v3';
import * as stravaClient from './stravaClient';
import { getValidAccessToken } from './tokenManager';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'; // Import Drizzle migrator
import { season } from './db/schema'; // Import the Drizzle table object 'season'
import LoginService from './services/LoginService';
import BatchFetchService from './services/BatchFetchService';
import WeekService from './services/WeekService';
import SeasonService from './services/SeasonService';
import ParticipantService from './services/ParticipantService';
import { AuthorizationService } from './services/AuthorizationService';
import authRouter from './routes/auth';
import publicRouter from './routes/public';
import fallbackRouter from './routes/fallback';
import { createFetchRouter } from './routes/admin/fetch';
import { createWebhookRouter } from './routes/webhooks';
import { WebhookLogger } from './webhooks/logger';
import { setupWebhookSubscription } from './webhooks/subscriptionManager';
import { WebhookRenewalService } from './services/WebhookRenewalService';

// Route modules (lazily loaded to avoid circular dependencies)
const routes = {
  auth: authRouter,
  public: publicRouter,
  fallback: fallbackRouter
};

// Log configuration on startup
logConfigOnStartup();


// Configure strava-v3 with credentials from config (skip if not set for tests)
if (config.stravaClientId && config.stravaClientSecret) {
  (strava.config as any)({
    client_id: config.stravaClientId,
    client_secret: config.stravaClientSecret,
    redirect_uri: config.stravaRedirectUri
  });
}

const PORT = config.port;

// Database path from config (persistent /data volume in production, local dev folder otherwise)
// (Handled in db.ts)

console.log('==========================================');

const app = express();

// CRITICAL: Trust reverse proxy (Railway uses nginx proxy)
app.set('trust proxy', 1);

// Enable CORS for frontend - use frontend URL from config
app.use(cors({ 
  origin: config.frontendUrl,
  credentials: true 
}));
app.use(express.json());

// Session configuration for OAuth
const sessionStoreConfig = {
  name: 'wmv.sid',
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: true,
  rolling: true,
  proxy: true,
  cookie: {
    secure: !config.isDevelopment,
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/'
  }
};

// Verify database is readable
try {
  const userVersion = db.prepare('PRAGMA user_version').get();
  console.log(`[DB] ✓ Database is readable - PRAGMA user_version: ${JSON.stringify(userVersion)}`);
} catch (err) {
  console.log(`[DB] ✗ ERROR reading database: ${(err as Error).message}`);
}

// Only use persistent session store in non-test environments
if (!isTestMode()) {
  console.log('[SESSION] Setting up SQLite session store using main database');
  const SqliteSessionStore = SqliteStore(session);
  (sessionStoreConfig as any).store = new SqliteSessionStore({
    client: db,
    expired: {
      clear: true,
      intervalMs: 900000
    }
  });
} else {
  console.log('[SESSION] Using memory session store (test mode)');
}

app.use(session(sessionStoreConfig as any));

app.use(
  '/trpc',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// Test mode: Load session injection middleware
if (isTestMode()) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const testMiddlewareModule = require('./__tests__/testMiddleware');
    const registerTestMiddleware = testMiddlewareModule.default || testMiddlewareModule;
    if (typeof registerTestMiddleware === 'function') {
      registerTestMiddleware(app);
    }
  } catch (err: any) {
    if (err.code !== 'MODULE_NOT_FOUND') {
      throw err;
    }
  }
}

// Initialize database schema using Drizzle migrations
console.log('[DB] Running Drizzle migrations...');
try {
  migrate(drizzleDb, { migrationsFolder: './drizzle' });
  console.log('[DB] ✓ Drizzle migrations applied successfully');
  
  // Log table information
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all() as Array<{ name: string }>;
  
  console.log(`[DB] ✓ Database has ${tables.length} tables: ${tables.map(t => t.name).join(', ')}`);
  
  // Log row counts for key tables
  const tablesToCheck = ['participant', 'week', 'season', 'activity', 'result', 'segment'];
  console.log('[DB] Row counts:');
  for (const tableName of tablesToCheck) {
    try {
      const countResult = db.prepare(`SELECT COUNT(*) as cnt FROM ${tableName}`).get() as { cnt: number };
      console.log(`[DB]   ${tableName}: ${countResult.cnt} rows`);
    } catch (e) {
      // Table might not exist, skip
    }
  }
} catch (err) {
  console.log(`[DB] ✗ ERROR applying Drizzle migrations: ${(err as Error).message}`);
  throw err;
}

// ========================================
// SERVICE INITIALIZATION
// ========================================

// Helper: Get admin athlete IDs from config
export function getAdminAthleteIds(): number[] {
  return config.adminAthleteIds;
}

// Initialize AuthorizationService with dependencies
const authorizationService = new AuthorizationService(getAdminAthleteIds);

// Initialize LoginService with dependencies
const loginService = new LoginService(drizzleDb, getAdminAthleteIds);

// Initialize BatchFetchService with dependencies
const batchFetchService = new BatchFetchService(
  drizzleDb,
  (database, athleteId) => getValidAccessToken(database, stravaClient, athleteId)
);

// Initialize WeekService with dependencies
const weekService = new WeekService(drizzleDb);

// Initialize SeasonService with dependencies
const seasonService = new SeasonService(drizzleDb);

// Initialize ParticipantService with dependencies
const participantService = new ParticipantService(drizzleDb);

// =========================================
// AUTHORIZATION HELPERS

// Create requireAdmin middleware from AuthorizationService
// const requireAdmin = authorizationService.createRequireAdminMiddleware();

// Export checkAuthorization for testing
const checkAuthorization = (req: any, adminRequired = false) => {
  return authorizationService.checkAuthorization(req.session?.stravaAthleteId, adminRequired);
};
// ========================================

// ========================================
// HELPER & MIDDLEWARE OBJECTS
// ========================================

// Services object for route handlers
const services = {
  loginService,
  batchFetchService,
  weekService,
  seasonService,
  participantService
};

// Middleware object for route handlers
// const _middleware: any = {
//   requireAdmin,
//   db,
//   getValidAccessToken: (athleteId: number) => getValidAccessToken(db, stravaClient, athleteId),
//   stravaClient
// };

// Initialize Webhook Logger
const webhookLogger = new WebhookLogger(drizzleDb);

// ========================================
// STATIC FILE SERVING (Frontend)
// ========================================

// Serve built frontend from dist/ directory
app.use(express.static(path.join(__dirname, '../../dist')));

// ===== ROUTE REGISTRATION =====
// Register modular route handlers

// Auth routes
app.use('/auth', routes.auth(services));

// Public routes (no authentication required)
app.use(routes.public());

// Public leaderboard routes (authenticated but not admin-only)
// app.use('/weeks', routes.weeks(services, middleware, db));
// app.use('/seasons', routes.seasons(services, middleware));

// Admin management routes (admin-only)
// app.use('/admin/weeks', routes.weeks(services, middleware, db));
// app.use('/admin/seasons', routes.seasons(services, middleware));
// app.use('/admin/participants', routes.participants(services, middleware));
// app.use('/admin/segments', routes.segments(services, middleware));
app.use('/admin', createFetchRouter(db, drizzleDb));

// Webhook routes
app.use('/webhooks', createWebhookRouter(webhookLogger, drizzleDb));

// SPA fallback: catch-all to serve index.html for client-side routing
app.use(routes.fallback());
// ===== END ROUTE REGISTRATION =====

// Export for testing
export { app, db, checkAuthorization };

// Only start server if not being imported for tests
if (!isTestMode()) {
  // Seed season on startup if needed
  // This seeding logic might also be better handled by Drizzle (seed scripts)
  const existingSeasons = db.prepare('SELECT COUNT(*) as count FROM season').get() as { count: number };
  if (existingSeasons.count === 0) {
    console.log('🌱 No seasons found. Creating Fall 2025 season...');
    const fallStart = Math.floor(new Date('2025-10-01T00:00:00Z').getTime() / 1000);
    const fallEnd = Math.floor(new Date('2025-12-31T23:59:59Z').getTime() / 1000);
    // Use Drizzle for seeding
    drizzleDb.insert(season).values({
      name: 'Fall 2025',
      start_at: fallStart,
      end_at: fallEnd,
      is_active: 1, // Assuming this column is still used by old logic somewhere
    }).run();
    console.log('✅ Fall 2025 season created (Oct 1 - Dec 31)');
  }
  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`WMV backend listening on port ${PORT}`);
    
    // Setup webhook subscription if enabled
    await setupWebhookSubscription();
    
    // Start automatic webhook subscription renewal service
    const webhookRenewalService = new WebhookRenewalService(drizzleDb);
    webhookRenewalService.start();
    
    // ===== TIMEZONE DIAGNOSTICS =====
    const utcString = new Date().toISOString(); // Using standard JS for now
    const now = new Date(utcString);
    const localString = now.toString();
    const tzOffsetMinutes = now.getTimezoneOffset();
    const tzOffsetHours = -tzOffsetMinutes / 60;
    
    console.log('[TIMEZONE DIAGNOSTIC] System timezone information:');
    console.log(`  Current UTC time: ${utcString}`);
    console.log(`  Current local time: ${localString}`);
    console.log(`  System timezone offset: UTC${tzOffsetHours >= 0 ? '+' : ''}${tzOffsetHours}`);
    console.log(`  System timezone name: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
    
    // Demonstrate timestamp conversions
    const exampleIso = '2025-10-28T12:00:00Z';
    const exampleUnix = Math.floor(new Date(exampleIso).getTime() / 1000);
    console.log('[TIMEZONE DIAGNOSTIC] Example UTC conversion:');
    console.log(`  ISO string "${exampleIso}" → Unix timestamp: ${exampleUnix}`);
    console.log(`  Back to ISO: ${new Date(exampleUnix * 1000).toISOString()}`);
    
    // Check database timezone context
    const seasonCheck = drizzleDb.select().from(season).limit(1).get(); // Use Drizzle for check
    if (seasonCheck) {
      console.log('[TIMEZONE DIAGNOSTIC] Database context:');
      console.log(`  Active season: ${seasonCheck.name} (Unix: ${seasonCheck.start_at} to ${seasonCheck.end_at})`);
    }
    // ===== END TIMEZONE DIAGNOSTICS =====
    
    // Log environment variables for debugging in Railway logs
    logEnvironmentVariables();
  });
}