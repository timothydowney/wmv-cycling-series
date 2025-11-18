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

// Helper to compute request base URL behind proxies (Railway)
function getBaseUrl(req) {
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http').toString();
  const host = (req.headers['x-forwarded-host'] || req.get('host') || '').toString();
  return `${proto}://${host}`;
}

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
// STATIC FILE SERVING (Frontend)
// ========================================

// Serve built frontend from dist/ directory
app.use(express.static(path.join(__dirname, '../../dist')));

// ========================================
// AUTHENTICATION ROUTES
// ========================================

// GET /auth/strava - Initiate OAuth flow
app.get('/auth/strava', (req, res) => {
  // Compute redirect URI with safe fallback if env not set
  const computedRedirect = `${getBaseUrl(req)}/auth/strava/callback`;
  const redirectUri = process.env.STRAVA_REDIRECT_URI || computedRedirect;

  // Helpful runtime trace (does not log secrets)
  console.log('[AUTH] Using STRAVA_REDIRECT_URI:', redirectUri);
  console.log('[AUTH] Using CLIENT_BASE_URL:', CLIENT_BASE_URL || '(not set, will fallback)');

  const stravaAuthUrl = 'https://www.strava.com/oauth/authorize?' +
    new URLSearchParams({
      client_id: process.env.STRAVA_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      approval_prompt: 'auto',  // 'force' to always show consent screen
      scope: 'activity:read,profile:read_all'
    });

  console.log('Redirecting to Strava OAuth:', stravaAuthUrl);
  res.redirect(stravaAuthUrl);
});

// GET /auth/strava/callback - Handle OAuth callback
app.get('/auth/strava/callback', async (req, res) => {
  const { code, scope } = req.query;
  
  if (!code) {
    console.error('OAuth callback missing authorization code');
    return res.redirect(`${CLIENT_BASE_URL}?error=authorization_denied`);
  }
  
  try {
    // Use LoginService to exchange code and create session
    await loginService.exchangeCodeAndCreateSession(code, req.session, scope);
    
    const stravaAthleteId = req.session.stravaAthleteId;
    const athleteName = req.session.athleteName;
    
    // Explicitly save session before redirecting (important for some session stores)
    console.log(`[AUTH] Saving session for athlete ${stravaAthleteId}...`);
    console.log('[AUTH] Session data before save:', {
      stravaAthleteId,
      athleteName,
      sessionID: req.sessionID
    });
    
    req.session.save((err) => {
      if (err) {
        console.error('[AUTH] Session save error:', err);
        return res.redirect(`${CLIENT_BASE_URL}?error=session_error`);
      }
      
      console.log(`[AUTH] Session saved successfully for athlete ${stravaAthleteId}`);
      console.log(`[AUTH] Session ID: ${req.sessionID}`);
      
      // Redirect to dashboard with safe fallback to request base URL
      const baseUrl = CLIENT_BASE_URL || getBaseUrl(req);
      const finalRedirect = `${baseUrl}?connected=true`;
      
      console.log(`[AUTH] Redirecting to ${finalRedirect}`);
      // The rolling: true option in sessionConfig ensures the Set-Cookie header is sent
      res.redirect(finalRedirect);
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`${CLIENT_BASE_URL}?error=server_error`);
  }
});

// GET /auth/status - Check authentication status
app.get('/auth/status', (req, res) => {
  console.log(`[AUTH_STATUS] Checking status. Session ID: ${req.sessionID}`);
  console.log('[AUTH_STATUS] Session data:', {
    stravaAthleteId: req.session.stravaAthleteId,
    athleteName: req.session.athleteName
  });
  
  try {
    if (!req.session.stravaAthleteId) {
      console.log('[AUTH_STATUS] No session found - not authenticated');
      return res.json({
        authenticated: false,
        participant: null,
        is_admin: false
      });
    }
    
    // Use LoginService to get full auth status
    const status = loginService.getAuthStatus(req.session.stravaAthleteId);
    console.log('[AUTH_STATUS] Auth status:', status);
    res.json(status);
  } catch (error) {
    console.error('Error getting auth status:', error);
    res.status(500).json({ error: 'Failed to get auth status' });
  }
});

// POST /auth/disconnect - Disconnect Strava account
app.post('/auth/disconnect', (req, res) => {
  if (!req.session.stravaAthleteId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const stravaAthleteId = req.session.stravaAthleteId;
  
  try {
    // Use LoginService to disconnect (delete tokens)
    loginService.disconnectStrava(stravaAthleteId);
    
    // Destroy session
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destruction error:', err);
        return res.status(500).json({ error: 'Failed to disconnect' });
      }
      res.json({ success: true, message: 'Disconnected from Strava' });
    });
  } catch (error) {
    console.error('Error disconnecting Strava:', error);
    res.status(500).json({ error: 'Failed to disconnect from Strava' });
  }
});

// ========================================
// USER DATA & PRIVACY
// ========================================

/**
 * DELETE /user/data
 * 
 * Request complete deletion of user data (GDPR compliance)
 * User must be authenticated
 * Deletion completes within 48 hours
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Data deletion request submitted",
 *   "timestamp": "2025-11-11T12:00:00Z",
 *   "deletionDeadline": "2025-11-13T12:00:00Z"
 * }
 */
app.post('/user/data/delete', (req, res) => {
  // Require authentication
  if (!req.session.stravaAthleteId) {
    return res.status(401).json({ error: 'Not authenticated. Please connect to Strava first.' });
  }

  const stravaAthleteId = req.session.stravaAthleteId;

  try {
    const result = userDataService.deleteUserData(stravaAthleteId);

    // Destroy session after data deletion
    req.session.destroy((err) => {
      if (err) {
        console.warn('[USER_DATA] Session destruction error during data deletion:', err);
      }
    });

    res.json(result);
  } catch (error) {
    console.error('[USER_DATA] Error during data deletion:', error);
    res.status(500).json({
      error: 'Failed to delete data',
      message: error.message || 'An unexpected error occurred',
      contact: 'Please contact admins@westmassvel.org if the problem persists'
    });
  }
});

/**
 * GET /user/data
 * 
 * Retrieve all personal data we hold about the user (GDPR Data Access)
 * User must be authenticated
 */
app.get('/user/data', (req, res) => {
  if (!req.session.stravaAthleteId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const stravaAthleteId = req.session.stravaAthleteId;

  try {
    const data = userDataService.getUserData(stravaAthleteId);
    res.json(data);
  } catch (error) {
    if (error.message === 'Participant not found') {
      return res.status(404).json({ error: 'Participant not found' });
    }
    console.error('[USER_DATA] Error retrieving user data:', error);
    res.status(500).json({
      error: 'Failed to retrieve data',
      message: error.message
    });
  }
});

// ========================================
// PUBLIC ROUTES
// ========================================

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/participants', (req, res) => {
  try {
    const participants = participantService.getAllParticipants();
    res.json(participants);
  } catch (error) {
    console.error('Failed to get participants:', error);
    res.status(500).json({ error: 'Failed to get participants', details: error.message });
  }
});

app.get('/segments', (req, res) => {
  const rows = db.prepare('SELECT strava_segment_id, name FROM segment').all();
  res.json(rows);
});

// ========================================
// SEASONS ENDPOINTS
// ========================================

app.get('/seasons', (req, res) => {
  try {
    const seasons = seasonService.getAllSeasons();
    res.json(seasons);
  } catch (error) {
    console.error('Failed to get seasons:', error);
    res.status(500).json({ error: 'Failed to get seasons', details: error.message });
  }
});

app.get('/seasons/:id', (req, res) => {
  const seasonId = parseInt(req.params.id, 10);
  try {
    const season = seasonService.getSeasonById(seasonId);
    res.json(season);
  } catch (error) {
    if (error.message === 'Season not found') {
      return res.status(404).json({ error: 'Season not found' });
    }
    console.error('Failed to get season:', error);
    res.status(500).json({ error: 'Failed to get season', details: error.message });
  }
});

app.get('/seasons/:id/leaderboard', (req, res) => {
  const seasonId = parseInt(req.params.id, 10);
  try {
    const result = seasonService.getSeasonLeaderboard(seasonId);
    res.json(result);
  } catch (error) {
    if (error.message === 'Season not found') {
      return res.status(404).json({ error: 'Season not found' });
    }
    console.error('Failed to get season leaderboard:', error);
    res.status(500).json({ error: 'Failed to get season leaderboard', details: error.message });
  }
});

// ========================================
// WEEKS ENDPOINTS
// ========================================

app.get('/weeks', (req, res) => {
  const seasonId = parseInt(req.query.season_id, 10);
  
  // season_id is required - UI is responsible for managing season state
  if (!seasonId || isNaN(seasonId)) {
    return res.status(400).json({ error: 'season_id query parameter is required' });
  }
  
  try {
    const weeks = weekService.getAllWeeks(seasonId);
    res.json(weeks);
  } catch (error) {
    console.error('Failed to get weeks:', error);
    res.status(500).json({ error: 'Failed to get weeks', details: error.message });
  }
});

app.get('/weeks/:id', (req, res) => {
  const weekId = parseInt(req.params.id, 10);
  
  try {
    const week = weekService.getWeekById(weekId);
    res.json(week);
  } catch (error) {
    if (error.message === 'Week not found') {
      return res.status(404).json({ error: 'Week not found' });
    }
    console.error('Failed to get week:', error);
    res.status(500).json({ error: 'Failed to get week', details: error.message });
  }
});

app.get('/weeks/:id/leaderboard', (req, res) => {
  const weekId = parseInt(req.params.id, 10);
  
  try {
    const result = weekService.getWeekLeaderboard(weekId);
    res.json(result);
  } catch (error) {
    if (error.message === 'Week not found') {
      return res.status(404).json({ error: 'Week not found' });
    }
    console.error('Failed to get week leaderboard:', error);
    res.status(500).json({ error: 'Failed to get week leaderboard', details: error.message });
  }
});

app.get('/weeks/:id/activities', (req, res) => {
  const weekId = parseInt(req.params.id, 10);
  
  try {
    const activities = weekService.getWeekActivities(weekId);
    res.json(activities);
  } catch (error) {
    console.error('Failed to get week activities:', error);
    res.status(500).json({ error: 'Failed to get week activities', details: error.message });
  }
});

app.get('/activities/:id/efforts', (req, res) => {
  const activityId = parseInt(req.params.id, 10);
  const efforts = db.prepare(`
    SELECT 
      se.effort_index,
      se.elapsed_seconds,
      se.start_at,
      se.pr_achieved,
      s.name as segment_name
    FROM segment_effort se
    JOIN segment s ON se.strava_segment_id = s.strava_segment_id
    WHERE se.activity_id = ?
    ORDER BY se.effort_index ASC
  `).all(activityId);

  res.json(efforts);
});

// ========================================
// ADMIN ENDPOINTS - Season Management
// ========================================

// Create a new season
app.post('/admin/seasons', requireAdmin, (req, res) => {
  try {
    const newSeason = seasonService.createSeason(req.body);
    res.status(201).json(newSeason);
  } catch (error) {
    console.error('Failed to create season:', error);
    res.status(400).json({ error: 'Failed to create season', details: error.message });
  }
});

// Update an existing season
app.put('/admin/seasons/:id', requireAdmin, (req, res) => {
  const seasonId = parseInt(req.params.id, 10);
  try {
    const updatedSeason = seasonService.updateSeason(seasonId, req.body);
    res.json(updatedSeason);
  } catch (error) {
    if (error.message === 'Season not found') {
      return res.status(404).json({ error: 'Season not found' });
    }
    if (error.message === 'No fields to update') {
      return res.status(400).json({ error: 'No fields to update' });
    }
    console.error('Failed to update season:', error);
    res.status(400).json({ error: 'Failed to update season', details: error.message });
  }
});

// Delete a season
app.delete('/admin/seasons/:id', requireAdmin, (req, res) => {
  const seasonId = parseInt(req.params.id, 10);
  try {
    const result = seasonService.deleteSeason(seasonId);
    res.json(result);
  } catch (error) {
    if (error.message === 'Season not found') {
      return res.status(404).json({ error: 'Season not found' });
    }
    if (error.message.includes('Cannot delete season with existing weeks')) {
      const match = error.message.match(/(\d+)\s+week/);
      const weekCount = match ? parseInt(match[1], 10) : 0;
      return res.status(400).json({ error: error.message, weeks_count: weekCount });
    }
    console.error('Failed to delete season:', error);
    res.status(500).json({ error: 'Failed to delete season', details: error.message });
  }
});

// ========================================
// ADMIN ENDPOINTS - Week Management
// ========================================

// Create a new week
app.post('/admin/weeks', requireAdmin, (req, res) => {
  try {
    const newWeek = weekService.createWeek(req.body);
    res.status(201).json(newWeek);
  } catch (error) {
    console.error('Failed to create week:', error);
    res.status(400).json({ error: 'Failed to create week', details: error.message });
  }
});

// Update an existing week
app.put('/admin/weeks/:id', requireAdmin, (req, res) => {
  const weekId = parseInt(req.params.id, 10);

  try {
    const updatedWeek = weekService.updateWeek(weekId, req.body);
    res.json(updatedWeek);
  } catch (error) {
    if (error.message === 'Week not found') {
      return res.status(404).json({ error: 'Week not found' });
    }
    if (error.message === 'No fields to update' || error.message === 'Invalid season_id' || error.message.includes('Invalid segment_id')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Failed to update week:', error);
    res.status(400).json({ error: 'Failed to update week', details: error.message });
  }
});

// Delete a week (and cascade delete activities, efforts, results)
app.delete('/admin/weeks/:id', requireAdmin, (req, res) => {
  const weekId = parseInt(req.params.id, 10);

  try {
    const result = weekService.deleteWeek(weekId);
    res.json(result);
  } catch (error) {
    if (error.message === 'Week not found') {
      return res.status(404).json({ error: 'Week not found' });
    }
    console.error('Failed to delete week:', error);
    res.status(500).json({ error: 'Failed to delete week', details: error.message });
  }
});

// Admin batch fetch results for a week
app.post('/admin/weeks/:id/fetch-results', requireAdmin, async (req, res) => {
  const weekId = parseInt(req.params.id, 10);
  
  try {
    // Use BatchFetchService to fetch and store results
    const summary = await batchFetchService.fetchWeekResults(weekId);
    
    res.json(summary);
  } catch (error) {
    console.error('Batch fetch error:', error);
    
    // Check if it's a "Week not found" error
    if (error.message === 'Week not found') {
      return res.status(404).json({ 
        error: 'Week not found'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch results',
      details: error.message
    });
  }
});

// Get all participants with connection status (admin endpoint)
app.get('/admin/participants', requireAdmin, (req, res) => {
  try {
    const participants = participantService.getAllParticipantsWithStatus();
    res.json(participants);
  } catch (error) {
    console.error('Failed to get participants:', error);
    res.status(500).json({ 
      error: 'Failed to fetch participants',
      details: error.message
    });
  }
});

// Get all known segments (for autocomplete)
app.get('/admin/segments', requireAdmin, (req, res) => {
  try {
    const segments = db.prepare(`
      SELECT 
        strava_segment_id as id,
        strava_segment_id,
        name,
        distance,
        average_grade,
        city,
        state,
        country
      FROM segment ORDER BY name
    `).all();
    
    res.json(segments);
  } catch (error) {
    console.error('Failed to get segments:', error);
    res.status(500).json({ 
      error: 'Failed to fetch segments',
      details: error.message
    });
  }
});

// Create or update a segment in our database
app.post('/admin/segments', requireAdmin, (req, res) => {
  const { strava_segment_id, name, distance, average_grade, city, state, country } = req.body || {};

  if (!strava_segment_id || !name) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['strava_segment_id', 'name']
    });
  }

  try {
    // Upsert segment by Strava ID with metadata
    db.prepare(`
      INSERT INTO segment (strava_segment_id, name, distance, average_grade, city, state, country)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(strava_segment_id) DO UPDATE SET 
        name = excluded.name,
        distance = excluded.distance,
        average_grade = excluded.average_grade,
        city = excluded.city,
        state = excluded.state,
        country = excluded.country
    `).run(strava_segment_id, name, distance, average_grade, city, state, country);

    const saved = db.prepare(`
      SELECT strava_segment_id as id, strava_segment_id, name, distance, average_grade, city, state, country
      FROM segment WHERE strava_segment_id = ?
    `).get(strava_segment_id);

    return res.status(201).json(saved);
  } catch (error) {
    console.error('Failed to upsert segment:', error);
    return res.status(500).json({ error: 'Failed to save segment', details: error.message });
  }
});

// Validate segment endpoint (checks if segment exists on Strava)
app.get('/admin/segments/:id/validate', requireAdmin, async (req, res) => {
  const segmentId = req.params.id;
  
  try {
    // Get any connected participant's token to query Strava API
    const tokenRecord = db.prepare(`
      SELECT access_token, strava_athlete_id FROM participant_token LIMIT 1
    `).get();
    
    if (!tokenRecord) {
      return res.status(400).json({ 
        error: 'No connected participants available to validate segment' 
      });
    }
    
    const accessToken = await getValidAccessToken(db, stravaClient, tokenRecord.strava_athlete_id);
    
    // Try to fetch segment details from Strava using stravaClient
    const segment = await stravaClient.getSegment(segmentId, accessToken);
    
    res.json({
      id: segment.id,
      name: segment.name,
      distance: segment.distance,
      average_grade: segment.average_grade,
      city: segment.city,
      state: segment.state,
      country: segment.country
    });
  } catch (error) {
    console.error('Segment validation error:', error);
    if (error.statusCode === 404) {
      res.status(404).json({ error: 'Segment not found on Strava' });
    } else {
      res.status(500).json({ 
        error: 'Failed to validate segment',
        details: error.message
      });
    }
  }
});
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

// ======================================================
// SPA FALLBACK (must be registered LAST)
// If no API/static route matched above, serve index.html
// This ensures client-side routes like /connect work in prod
// ======================================================
app.get('*', (req, res, next) => {
  // Let static assets (with extensions) and explicit API/admin paths fall through
  if (req.path.includes('.')) return next();

  // Do NOT intercept known backend route prefixes
  const apiPrefixes = [
    '/auth',
    '/admin',
    '/weeks',
    '/seasons',
    '/season',
    '/participants',
    '/activities',
    '/health'
  ];
  if (apiPrefixes.some(p => req.path.startsWith(p))) return next();

  // Otherwise, serve SPA entrypoint
  res.sendFile(path.join(__dirname, '../../dist/index.html'));
});
