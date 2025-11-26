// Configuration must be imported FIRST (it loads .env and provides all config)
import { config, logConfigOnStartup, logEnvironmentVariables, isTestMode } from './config';

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';

import Database from 'better-sqlite3';
import session from 'express-session';
import SqliteStore from 'better-sqlite3-session-store';
import strava from 'strava-v3';
import * as stravaClient from './stravaClient';
import { getValidAccessToken } from './tokenManager';
import { SCHEMA } from './schema';
import { isoToUnix, unixToISO, nowISO } from './dateUtils';
import { SeasonRow } from './types/database';
import runMigrations from './migrations';
import LoginService from './services/LoginService';
import BatchFetchService from './services/BatchFetchService';
import WeekService from './services/WeekService';
import SeasonService from './services/SeasonService';
import ParticipantService from './services/ParticipantService';
import { AuthorizationService } from './services/AuthorizationService';
import authRouter from './routes/auth';
import publicRouter from './routes/public';
import seasonsRouter from './routes/seasons';
import weeksRouter from './routes/weeks';
import participantsRouter from './routes/participants';
import segmentsRouter from './routes/segments';
import fallbackRouter from './routes/fallback';
import { createWebhookRouter } from './routes/webhooks';
import { createWebhookAdminRoutes } from './routes/admin/webhooks';
import { WebhookLogger } from './webhooks/logger';
import { setupWebhookSubscription } from './webhooks/subscriptionManager';
import { WebhookRenewalService } from './services/WebhookRenewalService';

// Route modules (lazily loaded to avoid circular dependencies)
const routes = {
  auth: authRouter,
  public: publicRouter,
  seasons: seasonsRouter,
  weeks: weeksRouter,
  participants: participantsRouter,
  segments: segmentsRouter,
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
// In development: ./server/data/wmv.db (local)
// In production (Railway): /data/wmv.db (persistent volume mounted in railway.toml)
const DB_PATH = config.databasePath;

// Check if database file exists and gather stats
const dbDir = path.dirname(DB_PATH);
const dbAbsolutePath = path.resolve(DB_PATH);

try {
  const stats = fs.statSync(dbAbsolutePath);
  console.log('[DB] ✓ Database file EXISTS');
  console.log(`[DB]   Size: ${stats.size} bytes`);
  console.log(`[DB]   Last modified: ${stats.mtime.toISOString()}`);
  console.log(`[DB]   Created: ${stats.birthtime.toISOString()}`);
  console.log(`[DB]   Is file: ${stats.isFile()}`);
} catch (err: any) {
  if (err.code === 'ENOENT') {
    console.log('[DB] ✗ Database file DOES NOT EXIST - will be created on first connection');
  } else {
    console.log(`[DB] ✗ ERROR checking database file: ${err.message}`);
  }
}

// Check if directory exists and is writable
try {
  const dirStats = fs.statSync(dbDir);
  console.log(`[DB] ✓ Database directory EXISTS: ${dbDir}`);
  console.log(`[DB]   Is directory: ${dirStats.isDirectory()}`);
  
  // Check write permissions by attempting to access parent directory
  try {
    fs.accessSync(dbDir, fs.constants.W_OK);
    console.log('[DB]   Directory is WRITABLE');
  } catch (err) {
    console.log(`[DB]   WARNING: Directory may NOT be writable: ${(err as Error).message}`);
  }
} catch (err: any) {
  if (err.code === 'ENOENT') {
    console.log(`[DB] ✗ Database directory DOES NOT EXIST: ${dbDir}`);
    console.log('[DB]   Attempting to create directory...');
    try {
      fs.mkdirSync(dbDir, { recursive: true });
      console.log(`[DB] ✓ Successfully created directory: ${dbDir}`);
    } catch (createErr) {
      console.log(`[DB] ✗ FAILED to create directory: ${(createErr as Error).message}`);
    }
  } else {
    console.log(`[DB] ✗ ERROR checking directory: ${err.message}`);
  }
}

console.log('==========================================');

const app = express();

// CRITICAL: Trust reverse proxy (Railway uses nginx proxy)
// This is REQUIRED for secure cookies to work behind a proxy
app.set('trust proxy', 1);

// Enable CORS for frontend - use frontend URL from config
app.use(cors({ 
  origin: config.frontendUrl,
  credentials: true // Important: allow cookies to be sent
}));
app.use(express.json());

// Session configuration for OAuth
// Based on express-session best practices and Passport.js patterns
const sessionStoreConfig = {
  name: 'wmv.sid',
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: true, // Ensure new sessions get a cookie
  rolling: true, // CRITICAL: Force session cookie to be set on EVERY response (including redirects)
  proxy: true, // CRITICAL: Trust reverse proxy (Railway) for X-Forwarded-Proto header
  cookie: {
    secure: !config.isDevelopment, // HTTPS only in production
    httpOnly: true,
    sameSite: 'lax' as const, // 'lax' allows cookies on safe redirects from Strava OAuth
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/' // Explicit path
  }
};

// Initialize DB first (needed for session store)
// Database path uses persistent /data volume on Railway, local dev folder otherwise
console.log('[DB] Connecting to database...');
const db: any = new Database(DB_PATH);
console.log('[DB] ✓ Database connection opened successfully');

// Verify database is readable by attempting a simple query
try {
  const userVersion = db.prepare('PRAGMA user_version').get();
  console.log(`[DB] ✓ Database is readable - PRAGMA user_version: ${JSON.stringify(userVersion)}`);
} catch (err) {
  console.log(`[DB] ✗ ERROR reading database: ${(err as Error).message}`);
}

// Only use persistent session store in non-test environments
// In test mode, use default MemoryStore to avoid open database handles
if (!isTestMode()) {
  console.log('[SESSION] Setting up SQLite session store using main database');
  const SqliteSessionStore = SqliteStore(session);
  (sessionStoreConfig as any).store = new SqliteSessionStore({
    client: db,
    expired: {
      clear: true,
      intervalMs: 900000 // Clear expired sessions every 15 minutes
    }
  });
} else {
  console.log('[SESSION] Using memory session store (test mode)');
}

app.use(session(sessionStoreConfig as any));

// Test mode: Load session injection middleware from separate test file
// SECURITY: This file only exists in source code, not in production builds
// It will only load if running in test mode
if (isTestMode()) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const testMiddlewareModule = require('./__tests__/testMiddleware');
    const registerTestMiddleware = testMiddlewareModule.default || testMiddlewareModule;
    if (typeof registerTestMiddleware === 'function') {
      registerTestMiddleware(app);
    }
  } catch (err: any) {
    // In production, this file won't exist - that's expected and correct
    // Only throw if it's a different kind of error
    if (err.code !== 'MODULE_NOT_FOUND') {
      throw err;
    }
  }
}

// Initialize database schema (single source of truth from schema.js)
console.log('[DB] Initializing database schema...');
try {
  db.exec(SCHEMA);
  console.log('[DB] ✓ Schema initialized successfully');
  
  // Run any pending migrations
  console.log('[DB] Running migrations...');
  runMigrations(db);
  console.log('[DB] ✓ Migrations completed');
  
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
  console.log(`[DB] ✗ ERROR initializing schema: ${(err as Error).message}`);
  throw err;
}

// ========================================
// SERVICE INITIALIZATION
// ========================================

// Helper: Get admin athlete IDs from config
function getAdminAthleteIds(): number[] {
  return config.adminAthleteIds;
}

// Initialize AuthorizationService with dependencies
const authorizationService = new AuthorizationService(getAdminAthleteIds);

// Initialize LoginService with dependencies
const loginService = new LoginService(db, getAdminAthleteIds);

// Initialize BatchFetchService with dependencies
const batchFetchService = new BatchFetchService(
  db,
  (database: typeof db, athleteId: number) => getValidAccessToken(database, stravaClient, athleteId)
);

// Initialize WeekService with dependencies
const weekService = new WeekService(db);

// Initialize SeasonService with dependencies
const seasonService = new SeasonService(db);

// Initialize ParticipantService with dependencies
const participantService = new ParticipantService(db);

// =========================================
// AUTHORIZATION HELPERS

// Create requireAdmin middleware from AuthorizationService
const requireAdmin = authorizationService.createRequireAdminMiddleware();

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
const middleware: any = {
  requireAdmin,
  db,
  getValidAccessToken: (athleteId: number) => getValidAccessToken(db, stravaClient, athleteId),
  stravaClient
};

// Initialize Webhook Logger (used for optional webhook event logging)
const webhookLogger = new WebhookLogger(db);

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
app.use(routes.public());  // /health, /participants, /segments

// Public leaderboard routes (authenticated but not admin-only)
// These allow users to view weeks, seasons, and leaderboards
app.use('/weeks', routes.weeks(services, middleware, db));
app.use('/seasons', routes.seasons(services, middleware));

// Admin management routes (admin-only)
// These allow admins to create, update, delete weeks and seasons
app.use('/admin/weeks', routes.weeks(services, middleware, db));
app.use('/admin/seasons', routes.seasons(services, middleware));
app.use('/admin/participants', routes.participants(services, middleware));
app.use('/admin/segments', routes.segments(services, middleware));
app.use('/admin/webhooks', createWebhookAdminRoutes(db));

// Webhook routes (for real-time Strava activity updates)
// GET /webhooks/strava - subscription validation
// POST /webhooks/strava - event receipt (guarded by feature flag)
app.use('/webhooks', createWebhookRouter(webhookLogger, db));

// SPA fallback: catch-all to serve index.html for client-side routing
app.use(routes.fallback());
// ===== END ROUTE REGISTRATION =====

// Export for testing
export { app, db, checkAuthorization };

// Only start server if not being imported for tests
// Skip startup in test mode
if (!isTestMode()) {
  // Seed season on startup if needed
  const existingSeasons = db.prepare('SELECT COUNT(*) as count FROM season').get() as { count: number };
  if (existingSeasons.count === 0) {
    console.log('🌱 No seasons found. Creating Fall 2025 season...');
    // Fall 2025: Oct 1 - Dec 31 (Unix timestamps in UTC)
    const fallStart = isoToUnix('2025-10-01T00:00:00Z');
    const fallEnd = isoToUnix('2025-12-31T23:59:59Z');
    db.prepare(`
      INSERT INTO season (id, name, start_at, end_at, is_active)
      VALUES (?, ?, ?, ?, ?)
    `).run(1, 'Fall 2025', fallStart, fallEnd, 1);
    console.log('✅ Fall 2025 season created (Oct 1 - Dec 31)');
  }

  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`WMV backend listening on port ${PORT}`);
    
    // Setup webhook subscription if enabled
    await setupWebhookSubscription();
    
    // Start automatic webhook subscription renewal service
    // Strava subscriptions expire after 24 hours and must be renewed
    const webhookRenewalService = new WebhookRenewalService(db);
    webhookRenewalService.start();
    
    // ===== TIMEZONE DIAGNOSTICS =====
    const utcString = nowISO();
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
    const exampleUnix = isoToUnix(exampleIso);
    console.log('[TIMEZONE DIAGNOSTIC] Example UTC conversion:');
    console.log(`  ISO string "${exampleIso}" → Unix timestamp: ${exampleUnix}`);
    console.log(`  Back to ISO: ${unixToISO(exampleUnix)}`);
    
    // Check database timezone context
    const seasonCheck = db.prepare('SELECT * FROM season LIMIT 1').get() as SeasonRow | undefined;
    if (seasonCheck) {
      console.log('[TIMEZONE DIAGNOSTIC] Database context:');
      console.log(`  Active season: ${seasonCheck.name} (Unix: ${seasonCheck.start_at} to ${seasonCheck.end_at})`);
    }
    // ===== END TIMEZONE DIAGNOSTICS =====
    
    // Log environment variables for debugging in Railway logs
    logEnvironmentVariables();
  });
}
