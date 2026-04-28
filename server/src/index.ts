// Configuration must be imported FIRST (it loads .env and provides all config)
import { config, logConfigOnStartup, logEnvironmentVariables, isTestMode } from './config';

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import type { Request } from 'express';

import { db, drizzleDb } from './db';
import * as trpcExpress from '@trpc/server/adapters/express';
import { createContext } from './trpc/context';
import { appRouter } from './routers';

import session from 'express-session';
import type { Session, SessionOptions } from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import strava from 'strava-v3';
import * as stravaClient from './stravaClient';
import { getValidAccessToken } from './tokenManager';
import { season } from './db/schema';
import LoginService from './services/LoginService';
import BatchFetchService from './services/BatchFetchService';
import WeekService from './services/WeekService';
import SeasonService from './services/SeasonService';
import ParticipantService from './services/ParticipantService';
import { AuthorizationService } from './services/AuthorizationService';
import { HydrationService } from './services/HydrationService';
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
  strava.config({
    access_token: '',
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
type AuthSession = Session & {
  stravaAthleteId?: string | number;
};

const sessionStoreConfig: SessionOptions = {
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

// Only use persistent session store in non-test environments
if (!isTestMode()) {
  console.log('[SESSION] Setting up Postgres session store');
  const PgSessionStore = connectPgSimple(session);
  sessionStoreConfig.store = new PgSessionStore({
    pool: db,
    tableName: 'sessions',
    createTableIfMissing: false,
    pruneSessionInterval: 900,
  });
} else {
  console.log('[SESSION] Using memory session store (test mode)');
}

app.use(session(sessionStoreConfig));

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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const testMiddlewareModule = require('./__tests__/testMiddleware');
    const registerTestMiddleware = testMiddlewareModule.default || testMiddlewareModule;
    if (typeof registerTestMiddleware === 'function') {
      registerTestMiddleware(app);
    }
  } catch (err) {
    if (!(err instanceof Error) || !('code' in err) || err.code !== 'MODULE_NOT_FOUND') {
      throw err;
    }
  }
}

const REQUIRED_TABLES = [
  'sessions',
  'participant',
  'season',
  'segment',
  'week',
  'activity',
  'segment_effort',
  'result',
  'participant_token',
  'deletion_request',
  'schema_migrations',
  'webhook_event',
  'webhook_subscription',
  'explorer_campaign',
  'explorer_destination',
  'explorer_destination_match',
  'explorer_destination_pin',
  'chain_wax_period',
  'chain_wax_activity',
  'chain_wax_puck',
] as const;

async function verifyDatabaseReady(): Promise<void> {
  const connection = await db.query<{ current_database: string; now: string }>(
    'SELECT current_database() AS current_database, NOW()::text AS now'
  );
  const current = connection.rows[0];
  console.log(`[DB] ✓ Connected to Postgres database ${current.current_database} at ${current.now}`);

  const tablesResult = await db.query<{ name: string }>(
    'SELECT tablename AS name FROM pg_tables WHERE schemaname = \'public\' ORDER BY tablename'
  );
  const tableNames = tablesResult.rows.map((row) => row.name);
  const missingTables = REQUIRED_TABLES.filter((tableName) => !tableNames.includes(tableName));

  if (missingTables.length > 0) {
    throw new Error(
      `Postgres schema is missing required tables: ${missingTables.join(', ')}. ` +
        'Run the Postgres bootstrap and SQLite import scripts before starting the backend.'
    );
  }

  console.log(`[DB] ✓ Database has ${tableNames.length} tables: ${tableNames.join(', ')}`);

  const tablesToCheck = ['participant', 'week', 'season', 'activity', 'result', 'segment'];
  console.log('[DB] Row counts:');
  for (const tableName of tablesToCheck) {
    const countResult = await db.query<{ cnt: number }>(`SELECT COUNT(*)::int AS cnt FROM ${tableName}`);
    console.log(`[DB]   ${tableName}: ${countResult.rows[0]?.cnt ?? 0} rows`);
  }
}

async function seedSeasonIfNeeded(): Promise<void> {
  const existingSeasons = await db.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM season');
  if ((existingSeasons.rows[0]?.count ?? 0) > 0) {
    return;
  }

  console.log('🌱 No seasons found. Creating Fall 2025 season...');
  const fallStart = Math.floor(new Date('2025-10-01T00:00:00Z').getTime() / 1000);
  const fallEnd = Math.floor(new Date('2025-12-31T23:59:59Z').getTime() / 1000);
  await drizzleDb.insert(season).values({
    name: 'Fall 2025',
    start_at: fallStart,
    end_at: fallEnd,
  }).execute();
  console.log('✅ Fall 2025 season created (Oct 1 - Dec 31)');
}

// ========================================
// SERVICE INITIALIZATION
// ========================================

// Helper: Get admin athlete IDs from config
export function getAdminAthleteIds(): string[] {
  return config.adminAthleteIds;
}

// Initialize AuthorizationService with dependencies
const authorizationService = new AuthorizationService(drizzleDb, getAdminAthleteIds);

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
const checkAuthorization = async (req: Request, adminRequired = false) => {
  const sessionData = req.session as AuthSession | undefined;
  return authorizationService.checkAuthorization(
    sessionData?.stravaAthleteId ? String(sessionData.stravaAthleteId) : undefined,
    adminRequired
  );
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
const frontendDistPath = path.resolve(__dirname, '../../dist');
console.log(`[Static] Serving frontend from: ${frontendDistPath}`);
if (!fs.existsSync(path.join(frontendDistPath, 'index.html'))) {
  console.warn(`[Static] WARNING: index.html not found in ${frontendDistPath}`);
}
app.use(express.static(frontendDistPath));

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
app.use('/admin', createFetchRouter(drizzleDb));

// Webhook routes
app.use('/webhooks', createWebhookRouter(webhookLogger, drizzleDb));

// SPA fallback: catch-all to serve index.html for client-side routing
app.use(routes.fallback());
// ===== END ROUTE REGISTRATION =====

// Export for testing
export { app, db, checkAuthorization };

async function startServer(): Promise<void> {
  await verifyDatabaseReady();

  if (!isTestMode()) {
    await seedSeasonIfNeeded();
  }

  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`WMV backend listening on port ${PORT}`);
    
    // Setup webhook subscription if enabled
    await setupWebhookSubscription();
    
    // Start automatic webhook subscription renewal service
    const webhookRenewalService = new WebhookRenewalService(drizzleDb);
    webhookRenewalService.start();

    // Start background hydration sweep for missing performance metrics
    // This runs once at startup to "seed" any data that was scraped without metrics
    const hydrationService = new HydrationService(drizzleDb);
    hydrationService.sweepAndHydrate(50).catch(err => {
      console.error('[Hydration] Background sweep failed:', err);
    });
    
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
    const seasonRows = await drizzleDb.select().from(season).limit(1).execute();
    const seasonCheck = seasonRows[0];
    if (seasonCheck) {
      console.log('[TIMEZONE DIAGNOSTIC] Database context:');
      console.log(`  Active season: ${seasonCheck.name} (Unix: ${seasonCheck.start_at} to ${seasonCheck.end_at})`);
    }
    // ===== END TIMEZONE DIAGNOSTICS =====
    
    // Log environment variables for debugging in Railway logs
    logEnvironmentVariables();
  });
}

if (!isTestMode()) {
  void startServer().catch((error) => {
    console.error('[BOOT] Failed to start backend:', error);
    process.exit(1);
  });
}