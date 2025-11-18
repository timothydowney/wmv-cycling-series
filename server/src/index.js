const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const Database = require('better-sqlite3');
const session = require('express-session');
const SqliteStore = require('better-sqlite3-session-store')(session);
const strava = require('strava-v3');
const { encryptToken } = require('./encryption');
const { SCHEMA } = require('./schema');
const stravaClient = require('./stravaClient');
const { getValidAccessToken } = require('./tokenManager');
const { isoToUnix, unixToISO, nowISO } = require('./dateUtils');
const LoginService = require('./services/LoginService');
const BatchFetchService = require('./services/BatchFetchService');
const WeekService = require('./services/WeekService');
const SeasonService = require('./services/SeasonService');
const ParticipantService = require('./services/ParticipantService');
const UserDataService = require('./services/UserDataService');

// Route modules (lazily loaded to avoid circular dependencies)
const routes = {
  auth: require('./routes/auth'),
  userData: require('./routes/userData'),
  public: require('./routes/public'),
  seasons: require('./routes/seasons'),
  weeks: require('./routes/weeks'),
  participants: require('./routes/participants'),
  segments: require('./routes/segments'),
  fallback: require('./routes/fallback')
};

/**
 * Ensure a time string ends with Z (UTC indicator)
 * @param {string} timeString - Time string potentially missing Z suffix
 * @returns {string} Time string with Z suffix
 */
// Moved to dateUtils.js - now imported above

// Load .env from project root (one level up from server directory)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Configure strava-v3 with credentials from environment (skip if not set for tests)
if (process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET) {
  strava.config({
    client_id: process.env.STRAVA_CLIENT_ID,
    client_secret: process.env.STRAVA_CLIENT_SECRET,
    redirect_uri: process.env.STRAVA_REDIRECT_URI
  });
}

const PORT = process.env.PORT || 3001;
const CLIENT_BASE_URL = process.env.CLIENT_BASE_URL || 'http://localhost:5173';

// Database path: use persistent /data volume in production, local dev folder otherwise
// In development: ./server/data/wmv.db (local)
// In production (Railway): /data/wmv.db (persistent volume mounted in railway.toml)
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'wmv.db');

// Log database startup information for troubleshooting mount/path issues
console.log('========== DATABASE INITIALIZATION ==========');
console.log(`[DB] NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
console.log(`[DB] DATABASE_PATH env var: ${process.env.DATABASE_PATH || '(not set - using default)'}`);
console.log(`[DB] Resolved DB_PATH: ${DB_PATH}`);
console.log(`[DB] Absolute DB_PATH: ${path.resolve(DB_PATH)}`);

// Check if database file exists and gather stats
const fs = require('fs');
const dbDir = path.dirname(DB_PATH);
const dbAbsolutePath = path.resolve(DB_PATH);

try {
  const stats = fs.statSync(dbAbsolutePath);
  console.log('[DB] ✓ Database file EXISTS');
  console.log(`[DB]   Size: ${stats.size} bytes`);
  console.log(`[DB]   Last modified: ${stats.mtime.toISOString()}`);
  console.log(`[DB]   Created: ${stats.birthtime.toISOString()}`);
  console.log(`[DB]   Is file: ${stats.isFile()}`);
} catch (err) {
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
    console.log(`[DB]   WARNING: Directory may NOT be writable: ${err.message}`);
  }
} catch (err) {
  if (err.code === 'ENOENT') {
    console.log(`[DB] ✗ Database directory DOES NOT EXIST: ${dbDir}`);
    console.log('[DB]   Attempting to create directory...');
    try {
      require('fs').mkdirSync(dbDir, { recursive: true });
      console.log(`[DB] ✓ Successfully created directory: ${dbDir}`);
    } catch (createErr) {
      console.log(`[DB] ✗ FAILED to create directory: ${createErr.message}`);
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

// Enable CORS for frontend - use CLIENT_BASE_URL environment variable
app.use(cors({ 
  origin: CLIENT_BASE_URL,
  credentials: true // Important: allow cookies to be sent
}));
app.use(express.json());

// Session configuration for OAuth
// Based on express-session best practices and Passport.js patterns
const sessionConfig = {
  name: 'wmv.sid',
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: true, // Ensure new sessions get a cookie
  rolling: true, // CRITICAL: Force session cookie to be set on EVERY response (including redirects)
  proxy: true, // CRITICAL: Trust reverse proxy (Railway) for X-Forwarded-Proto header
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    sameSite: 'lax', // 'lax' allows cookies on safe redirects from Strava OAuth
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/' // Explicit path
  }
};

// Initialize DB first (needed for session store)
// Database path uses persistent /data volume on Railway, local dev folder otherwise
console.log('[DB] Connecting to database...');
const db = new Database(DB_PATH);
console.log('[DB] ✓ Database connection opened successfully');

// Verify database is readable by attempting a simple query
try {
  const userVersion = db.prepare('PRAGMA user_version').get();
  console.log(`[DB] ✓ Database is readable - PRAGMA user_version: ${JSON.stringify(userVersion)}`);
} catch (err) {
  console.log(`[DB] ✗ ERROR reading database: ${err.message}`);
}

// Only use persistent session store in non-test environments
// In test mode, use default MemoryStore to avoid open database handles
if (process.env.NODE_ENV !== 'test') {
  console.log('[SESSION] Setting up SQLite session store using main database');
  sessionConfig.store = new SqliteStore({
    client: db,
    expired: {
      clear: true,
      intervalMs: 900000 // Clear expired sessions every 15 minutes
    }
  });
} else {
  console.log('[SESSION] Using memory session store (test mode)');
}

app.use(session(sessionConfig));

// Test mode: Load session injection middleware from separate test file
// SECURITY: This file only exists in source code, not in production builds
// It will only load if NODE_ENV is explicitly 'test'
if (process.env.NODE_ENV === 'test') {
  try {
    const registerTestMiddleware = require('./__tests__/testMiddleware');
    registerTestMiddleware(app);
  } catch (err) {
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
  
  // Log table information
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all();
  
  console.log(`[DB] ✓ Database has ${tables.length} tables: ${tables.map(t => t.name).join(', ')}`);
  
  // Log row counts for key tables
  const tablesToCheck = ['participant', 'week', 'season', 'activity', 'result', 'segment'];
  console.log('[DB] Row counts:');
  for (const tableName of tablesToCheck) {
    try {
      const count = db.prepare(`SELECT COUNT(*) as cnt FROM ${tableName}`).get().cnt;
      console.log(`[DB]   ${tableName}: ${count} rows`);
    } catch (e) {
      // Table might not exist, skip
    }
  }
} catch (err) {
  console.log(`[DB] ✗ ERROR initializing schema: ${err.message}`);
  throw err;
}

// ========================================
// SERVICE INITIALIZATION
// ========================================

// Helper: Parse and cache admin athlete IDs from environment variable
function getAdminAthleteIds() {
  if (!process.env.ADMIN_ATHLETE_IDS) {
    return [];
  }
  return process.env.ADMIN_ATHLETE_IDS
    .split(',')
    .map(id => parseInt(id.trim()))
    .filter(id => !isNaN(id));
}

// Initialize LoginService with dependencies
const loginService = new LoginService(db, stravaClient, encryptToken, getAdminAthleteIds);

// Initialize BatchFetchService with dependencies
const batchFetchService = new BatchFetchService(db, stravaClient, getValidAccessToken);

// Initialize WeekService with dependencies
const weekService = new WeekService(db);

// Initialize SeasonService with dependencies
const seasonService = new SeasonService(db);

// Initialize ParticipantService with dependencies
const participantService = new ParticipantService(db);

// Initialize UserDataService with dependencies
const userDataService = new UserDataService(db, nowISO);

// ========================================
// AUTHORIZATION HELPERS
// ========================================

// Helper: Check if a user is authenticated and optionally if they're an admin
// This is extracted as a mockable function for testing
function checkAuthorization(req, adminRequired = false) {
  // First check: must be authenticated
  if (!req.session.stravaAthleteId) {
    return {
      authorized: false,
      statusCode: 401,
      message: 'Not authenticated. Please connect to Strava first.'
    };
  }
  
  // Second check: if admin required, verify admin status
  if (adminRequired) {
    const adminIds = getAdminAthleteIds();
    if (!adminIds.includes(req.session.stravaAthleteId)) {
      console.warn(`[AUTH] Non-admin access attempt by athlete ${req.session.stravaAthleteId} to ${req.path}`);
      return {
        authorized: false,
        statusCode: 403,
        message: 'Forbidden. Admin access required.'
      };
    }
  }
  
  return {
    authorized: true,
    statusCode: 200
  };
}

// Middleware: Require admin role
const requireAdmin = (req, res, next) => {
  const authCheck = checkAuthorization(req, true);
  
  if (!authCheck.authorized) {
    return res.status(authCheck.statusCode).json({ error: authCheck.message });
  }
  
  // Pass through to next handler
  next();
};

// ========================================
// HELPER & MIDDLEWARE OBJECTS
// ========================================

// Services object for route handlers
const services = {
  loginService,
  batchFetchService,
  weekService,
  seasonService,
  participantService,
  userDataService
};

// Helpers object for route handlers
const helpers = {
  getBaseUrl: (req) => {
    // Use CLIENT_BASE_URL if configured, otherwise build from request
    if (CLIENT_BASE_URL) return CLIENT_BASE_URL;
    return `${req.protocol}://${req.get('host')}`;
  },
  CLIENT_BASE_URL,
  db
};

// Middleware object for route handlers
const middleware = {
  requireAdmin,
  db,
  getValidAccessToken,
  stravaClient
};

// ========================================
// STATIC FILE SERVING (Frontend)
// ========================================

// Serve built frontend from dist/ directory
app.use(express.static(path.join(__dirname, '../../dist')));

// ===== ROUTE REGISTRATION =====
// Register modular route handlers

// Auth routes
app.use('/auth', routes.auth(services, helpers));

// User data routes
app.use('/user', routes.userData(services));

// Public routes (no authentication required)
app.use(routes.public(services, helpers));  // /health, /participants, /segments

// Public leaderboard routes (authenticated but not admin-only)
// These allow users to view weeks, seasons, and leaderboards
app.use('/weeks', routes.weeks(services, middleware));
app.use('/seasons', routes.seasons(services, middleware));

// Admin management routes (admin-only)
// These allow admins to create, update, delete weeks and seasons
app.use('/admin/weeks', routes.weeks(services, middleware));
app.use('/admin/seasons', routes.seasons(services, middleware));
app.use('/admin/participants', routes.participants(services, middleware));
app.use('/admin/segments', routes.segments(services, middleware));

// Segment effort details endpoint
app.get('/activities/:id/efforts', async (req, res) => {
  try {
    const { id: activityId } = req.params;
    const efforts = db.prepare(`
      SELECT se.* FROM segment_effort se
      WHERE se.activity_id = ?
      ORDER BY se.effort_index ASC
    `).all(activityId);
    
    res.json(efforts);
  } catch (error) {
    console.error('Failed to fetch segment efforts:', error);
    res.status(500).json({ error: error.message });
  }
});

// SPA fallback: catch-all to serve index.html for client-side routing
app.use(routes.fallback());
// ===== END ROUTE REGISTRATION =====

// Export for testing
module.exports = { app, db, checkAuthorization };

// Only start server if not being imported for tests
if (require.main === module) {
  // Seed season on startup if needed
  const existingSeasons = db.prepare('SELECT COUNT(*) as count FROM season').get();
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WMV backend listening on port ${PORT}`);
    
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
    const seasonCheck = db.prepare('SELECT * FROM season LIMIT 1').get();
    if (seasonCheck) {
      console.log('[TIMEZONE DIAGNOSTIC] Database context:');
      console.log(`  Active season: ${seasonCheck.name} (Unix: ${seasonCheck.start_at} to ${seasonCheck.end_at})`);
    }
    // ===== END TIMEZONE DIAGNOSTICS =====
    
    // Startup diagnostics (non-sensitive) for env verification in Railway logs
    const safeEnv = {
      NODE_ENV: process.env.NODE_ENV,
      CLIENT_BASE_URL: process.env.CLIENT_BASE_URL,
      STRAVA_REDIRECT_URI: process.env.STRAVA_REDIRECT_URI,
      STRAVA_CLIENT_ID: process.env.STRAVA_CLIENT_ID,
      DATABASE_PATH: process.env.DATABASE_PATH,
      TOKEN_ENCRYPTION_KEY_LENGTH: process.env.TOKEN_ENCRYPTION_KEY ? process.env.TOKEN_ENCRYPTION_KEY.length : 'missing'
    };
    console.log('[STARTUP] Effective env summary:', safeEnv);
    if (!process.env.CLIENT_BASE_URL) {
      console.warn('[STARTUP] CLIENT_BASE_URL not set; will fallback to request host for final redirects.');
    }
    if (!process.env.STRAVA_REDIRECT_URI) {
      console.warn('[STARTUP] STRAVA_REDIRECT_URI not set; /auth/strava will compute one from request host.');
    }
  });
}
