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
const activityProcessor = require('./activityProcessor');
const { getValidAccessToken } = require('./tokenManager');
const { storeActivityAndEfforts } = require('./activityStorage');
const { isoToUnix, unixToISO, nowISO, secondsToHHMMSS, defaultDayTimeWindow } = require('./dateUtils');

/**
 * Ensure a time string ends with Z (UTC indicator)
 * @param {string} timeString - Time string potentially missing Z suffix
 * @returns {string} Time string with Z suffix
 */
function normalizeTimeWithZ(timeString) {
  if (!timeString) return timeString;
  if (typeof timeString !== 'string') return timeString;
  // If it doesn't end with Z and has T, add Z
  if (timeString.includes('T') && !timeString.endsWith('Z')) {
    console.warn(`[TIME NORMALIZATION] Adding missing Z suffix to: '${timeString}'`);
    return timeString + 'Z';
  }
  return timeString;
}

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
// AUTHORIZATION HELPERS
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
// UTILITY FUNCTIONS
// ========================================

// Import module functions directly (no wrappers needed)
const { findBestQualifyingActivity } = activityProcessor;

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
    // Exchange authorization code for tokens using stravaClient
    console.log('Exchanging OAuth code for tokens...');
    const tokenData = await stravaClient.exchangeAuthorizationCode(code);
    
    const stravaAthleteId = tokenData.athlete.id;
    const athleteName = `${tokenData.athlete.firstname} ${tokenData.athlete.lastname}`;
    
    console.log(`OAuth successful for Strava athlete ${stravaAthleteId} (${athleteName})`);
    
    // Upsert participant in database (using athlete ID as primary key)
    db.prepare(`
      INSERT INTO participant (strava_athlete_id, name)
      VALUES (?, ?)
      ON CONFLICT(strava_athlete_id) DO UPDATE SET name = excluded.name
    `).run(stravaAthleteId, athleteName);
    
    console.log(`Participant record ensured for ${athleteName}`);
    
    // Store tokens for this participant (ENCRYPTED)
    db.prepare(`
      INSERT OR REPLACE INTO participant_token 
      (strava_athlete_id, access_token, refresh_token, expires_at, scope)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      stravaAthleteId,
      encryptToken(tokenData.access_token),
      encryptToken(tokenData.refresh_token),
      tokenData.expires_at,
      scope || tokenData.scope
    );
    
    console.log(`Tokens stored (encrypted) for participant ${stravaAthleteId}`);
    
    // Store session (use Strava athlete ID as the session identifier)
    req.session.stravaAthleteId = stravaAthleteId;
    req.session.athleteName = tokenData.athlete.firstname;
    
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
  
  if (req.session.stravaAthleteId) {
    const participant = db.prepare(`
      SELECT p.strava_athlete_id, p.name,
             CASE WHEN pt.strava_athlete_id IS NOT NULL THEN 1 ELSE 0 END as is_connected
      FROM participant p
      LEFT JOIN participant_token pt ON p.strava_athlete_id = pt.strava_athlete_id
      WHERE p.strava_athlete_id = ?
    `).get(req.session.stravaAthleteId);
    
    console.log('[AUTH_STATUS] Found participant:', participant);
    
    // Check if user is admin
    const adminIds = getAdminAthleteIds();
    const isAdmin = adminIds.includes(req.session.stravaAthleteId);
    
    res.json({
      authenticated: true,
      participant: participant,
      is_admin: isAdmin
    });
  } else {
    console.log('[AUTH_STATUS] No session found - not authenticated');
    res.json({
      authenticated: false,
      participant: null,
      is_admin: false
    });
  }
});

// POST /auth/disconnect - Disconnect Strava account
app.post('/auth/disconnect', (req, res) => {
  if (!req.session.stravaAthleteId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const stravaAthleteId = req.session.stravaAthleteId;
  
  // Delete tokens from database
  db.prepare('DELETE FROM participant_token WHERE strava_athlete_id = ?').run(stravaAthleteId);
  
  // Destroy session
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
      return res.status(500).json({ error: 'Failed to disconnect' });
    }
    res.json({ success: true, message: 'Disconnected from Strava' });
  });
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
    // Start transaction for data deletion
    const deleteTransaction = db.transaction(() => {
      // 1. Delete all segment efforts (linked to activities)
      db.prepare(`
        DELETE FROM segment_effort WHERE activity_id IN (
          SELECT id FROM activity WHERE strava_athlete_id = ?
        )
      `).run(stravaAthleteId);
      
      // 2. Delete all activities
      db.prepare('DELETE FROM activity WHERE strava_athlete_id = ?').run(stravaAthleteId);
      
      // 3. Delete all results
      db.prepare('DELETE FROM result WHERE strava_athlete_id = ?').run(stravaAthleteId);
      
      // 4. Delete OAuth tokens
      db.prepare('DELETE FROM participant_token WHERE strava_athlete_id = ?').run(stravaAthleteId);
      
      // 5. Log deletion request BEFORE deleting participant (foreign key constraint)
      const deletionTimestamp = nowISO();
      db.prepare(`
        INSERT INTO deletion_request (strava_athlete_id, requested_at, status, completed_at)
        VALUES (?, ?, ?, ?)
      `).run(stravaAthleteId, deletionTimestamp, 'completed', deletionTimestamp);
      
      // 6. Delete participant record (after logging to maintain foreign key)
      db.prepare('DELETE FROM participant WHERE strava_athlete_id = ?').run(stravaAthleteId);
    });
    
    // Execute the transaction
    deleteTransaction();
    
    // Destroy session after data deletion
    req.session.destroy((err) => {
      if (err) {
        console.warn('[USER_DATA] Session destruction error during data deletion:', err);
      }
    });
    
    // Return success response
    const deletionTimestamp = nowISO();
    
    res.json({
      success: true,
      message: 'Your data has been deleted from the WMV application',
      timestamp: deletionTimestamp,
      info: 'All activities, results, and tokens have been removed. This action cannot be undone.',
      nextSteps: 'You can reconnect with Strava anytime to participate in future competitions'
    });
    
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
 * 
 * Response:
 * {
 *   "athlete": { ... },
 *   "activities": [ ... ],
 *   "results": [ ... ],
 *   "tokens": { ... }
 * }
 */
app.get('/user/data', (req, res) => {
  if (!req.session.stravaAthleteId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const stravaAthleteId = req.session.stravaAthleteId;
  
  try {
    // Get participant info
    const participant = db.prepare('SELECT * FROM participant WHERE strava_athlete_id = ?').get(stravaAthleteId);
    
    if (!participant) {
      return res.status(404).json({ error: 'Participant not found' });
    }
    
    // Get all activities
    const activities = db.prepare('SELECT * FROM activity WHERE strava_athlete_id = ?').all(stravaAthleteId);
    
    // Get all results
    const results = db.prepare('SELECT * FROM result WHERE strava_athlete_id = ?').all(stravaAthleteId);
    
    // Get segment efforts for all activities
    const efforts = db.prepare(`
      SELECT se.* FROM segment_effort se
      JOIN activity a ON se.activity_id = a.id
      WHERE a.strava_athlete_id = ?
    `).all(stravaAthleteId);
    
    // Get token info (without actual token values)
    const tokenInfo = db.prepare(`
      SELECT 
        id,
        strava_athlete_id,
        created_at,
        updated_at,
        'REDACTED' as access_token,
        'REDACTED' as refresh_token
      FROM participant_token WHERE strava_athlete_id = ?
    `).get(stravaAthleteId);
    
    // Return all data
    res.json({
      exportedAt: nowISO(),
      participant: {
        name: participant.name,
        stravaAthleteId: participant.strava_athlete_id,
        createdAt: participant.created_at
      },
      activities: activities,
      results: results,
      segmentEfforts: efforts,
      tokens: tokenInfo ? { stored: true, createdAt: tokenInfo.created_at } : null,
      note: 'This is your personal data export. Tokens are redacted for security.'
    });
    
  } catch (error) {
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
  const rows = db.prepare('SELECT id, name, strava_athlete_id FROM participant').all();
  res.json(rows);
});

app.get('/segments', (req, res) => {
  const rows = db.prepare('SELECT strava_segment_id, name FROM segment').all();
  res.json(rows);
});

// ========================================
// SEASONS ENDPOINTS
// ========================================

app.get('/seasons', (req, res) => {
  const seasons = db.prepare('SELECT id, name, start_at, end_at, is_active FROM season ORDER BY start_at DESC').all();
  res.json(seasons);
});

app.get('/seasons/:id', (req, res) => {
  const seasonId = parseInt(req.params.id, 10);
  const season = db.prepare('SELECT id, name, start_at, end_at, is_active FROM season WHERE id = ?').get(seasonId);
  if (!season) return res.status(404).json({ error: 'Season not found' });
  res.json(season);
});

app.get('/seasons/:id/leaderboard', (req, res) => {
  const seasonId = parseInt(req.params.id, 10);
  
  const season = db.prepare('SELECT id, name, start_at, end_at FROM season WHERE id = ?').get(seasonId);
  if (!season) return res.status(404).json({ error: 'Season not found' });

  // Compute season standings by summing weekly scores calculated on read
  // This ensures total points are always correct even if users delete their data
  
  // Get all weeks in this season
  const weeks = db.prepare(`
    SELECT id, week_name, start_at FROM week WHERE season_id = ? ORDER BY start_at ASC
  `).all(seasonId);

  const allParticipantScores = {};  // { athlete_id: { name, total_points, weeks_completed } }

  // Compute from activities (source of truth)
  weeks.forEach(week => {
    const activities = db.prepare(`
      SELECT 
        a.id as activity_id,
        a.strava_athlete_id as participant_id,
        p.name,
        SUM(se.elapsed_seconds) as total_time_seconds,
        MAX(se.pr_achieved) as achieved_pr
      FROM activity a
      JOIN segment_effort se ON a.id = se.activity_id
      JOIN participant p ON a.strava_athlete_id = p.strava_athlete_id
      WHERE a.week_id = ? AND a.validation_status = 'valid'
      GROUP BY a.id, a.strava_athlete_id, p.name
      ORDER BY total_time_seconds ASC
    `).all(week.id);

    const totalParticipants = activities.length;
    
    // Compute scores for this week
    activities.forEach((activity, index) => {
      const rank = index + 1;
      const basePoints = (totalParticipants - rank) + 1;
      const prBonus = activity.achieved_pr ? 1 : 0;
      const weekPoints = basePoints + prBonus;

      if (!allParticipantScores[activity.participant_id]) {
        allParticipantScores[activity.participant_id] = {
          name: activity.name,
          total_points: 0,
          weeks_completed: 0
        };
      }

      allParticipantScores[activity.participant_id].total_points += weekPoints;
      allParticipantScores[activity.participant_id].weeks_completed += 1;
    });
  });

  // Convert to sorted array
  const seasonResults = Object.entries(allParticipantScores)
    .map(([id, data]) => ({
      id: parseInt(id),
      name: data.name,
      total_points: data.total_points,
      weeks_completed: data.weeks_completed
    }))
    .sort((a, b) => {
      if (b.total_points !== a.total_points) {
        return b.total_points - a.total_points;
      }
      return b.weeks_completed - a.weeks_completed;
    });

  res.json({ season, leaderboard: seasonResults });
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
  
  const query = `
    SELECT w.id, w.season_id, w.week_name, w.strava_segment_id as segment_id, w.required_laps, 
           w.start_at, w.end_at, s.name as segment_name
    FROM week w
    LEFT JOIN segment s ON w.strava_segment_id = s.strava_segment_id
    WHERE w.season_id = ?
    ORDER BY w.start_at DESC
  `;
  
  const rows = db.prepare(query).all(seasonId);
  res.json(rows);
});

app.get('/weeks/:id', (req, res) => {
  const weekId = parseInt(req.params.id, 10);
  const week = db.prepare(`
    SELECT w.id, w.season_id, w.week_name, w.strava_segment_id as segment_id, w.required_laps, 
           w.start_at, w.end_at, s.name as segment_name
    FROM week w
    LEFT JOIN segment s ON w.strava_segment_id = s.strava_segment_id
    WHERE w.id = ?
  `).get(weekId);
  if (!week) return res.status(404).json({ error: 'Week not found' });
  res.json(week);
});

app.get('/weeks/:id/leaderboard', (req, res) => {
  const weekId = parseInt(req.params.id, 10);
  const week = db.prepare(`
    SELECT w.id, w.season_id, w.week_name, w.strava_segment_id as segment_id, w.required_laps, w.start_at, w.end_at,
           s.name as segment_name
    FROM week w
    LEFT JOIN segment s ON w.strava_segment_id = s.strava_segment_id
    WHERE w.id = ?
  `).get(weekId);
  if (!week) return res.status(404).json({ error: 'Week not found' });

  // IMPORTANT: Compute leaderboard scores on read, not from stored database records
  // This ensures scores are always correct even if users delete their data
  // Scoring is computed fresh from activities table each time
  
  // Get activities with their segment efforts (sorted by total time)
  const activitiesWithTotals = db.prepare(`
    SELECT 
      a.id as activity_id,
      a.strava_athlete_id as participant_id,
      a.strava_activity_id,
      a.device_name,
      p.name,
      SUM(se.elapsed_seconds) as total_time_seconds,
      MAX(se.pr_achieved) as achieved_pr
    FROM activity a
    JOIN segment_effort se ON a.id = se.activity_id
    JOIN participant p ON a.strava_athlete_id = p.strava_athlete_id
    WHERE a.week_id = ? AND a.validation_status = 'valid' AND se.strava_segment_id = ?
    GROUP BY a.id, a.strava_athlete_id, a.strava_activity_id, a.device_name, p.name
    ORDER BY total_time_seconds ASC
  `).all(weekId, week.segment_id);

  // Compute leaderboard scores from activities (always correct)
  const totalParticipants = activitiesWithTotals.length;
  const leaderboard = activitiesWithTotals.map((activity, index) => {
    const rank = index + 1;
    const basePoints = (totalParticipants - rank) + 1;  // Beat (total - rank) people + 1 for competing
    const prBonus = activity.achieved_pr ? 1 : 0;
    const totalPoints = basePoints + prBonus;
    
    // Fetch individual segment efforts for this activity
    const efforts = db.prepare(`
      SELECT elapsed_seconds, effort_index, pr_achieved, strava_effort_id
      FROM segment_effort
      WHERE activity_id = ? AND strava_segment_id = ?
      ORDER BY effort_index ASC
    `).all(activity.activity_id, week.segment_id);
    
    // Build effort breakdown (only if more than 1 effort required)
    let effortBreakdown = null;
    if (week.required_laps > 1) {
      effortBreakdown = efforts.map(e => ({
        lap: e.effort_index + 1,
        time_seconds: e.elapsed_seconds,
        time_hhmmss: secondsToHHMMSS(e.elapsed_seconds),
        is_pr: e.pr_achieved ? true : false,
        strava_effort_id: e.strava_effort_id
      }));
    }
    
    return {
      rank: rank,
      participant_id: activity.participant_id,
      name: activity.name,
      total_time_seconds: activity.total_time_seconds,
      time_hhmmss: secondsToHHMMSS(activity.total_time_seconds),
      effort_breakdown: effortBreakdown,  // null if only 1 lap, array if multiple
      points: totalPoints,
      pr_bonus_points: prBonus,
      device_name: activity.device_name,
      activity_url: `https://www.strava.com/activities/${activity.strava_activity_id}/`,
      strava_effort_id: efforts.length > 0 ? efforts[0].strava_effort_id : null  // For single-lap linking
    };
  });
  
  res.json({ week, leaderboard });
});

app.get('/weeks/:id/activities', (req, res) => {
  const weekId = parseInt(req.params.id, 10);
  const activities = db.prepare(`
    SELECT 
      a.id,
      a.strava_athlete_id as participant_id,
      p.name as participant_name,
      a.strava_activity_id,
      a.validation_status,
      a.validation_message
    FROM activity a
    JOIN participant p ON a.strava_athlete_id = p.strava_athlete_id
    WHERE a.week_id = ?
    ORDER BY a.strava_athlete_id
  `).all(weekId);

  res.json(activities);
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
  const { name, start_at, end_at, is_active } = req.body;

  if (!name || start_at === undefined || end_at === undefined) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      required: ['name', 'start_at', 'end_at']
    });
  }

  try {
    // If setting as active, deactivate other seasons first
    if (is_active) {
      db.prepare('UPDATE season SET is_active = 0').run();
    }

    const result = db.prepare(`
      INSERT INTO season (name, start_at, end_at, is_active)
      VALUES (?, ?, ?, ?)
    `).run(name, start_at, end_at, is_active ? 1 : 0);

    const newSeason = db.prepare('SELECT id, name, start_at, end_at, is_active FROM season WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newSeason);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create season', details: error.message });
  }
});

// Update an existing season
app.put('/admin/seasons/:id', requireAdmin, (req, res) => {
  const seasonId = parseInt(req.params.id, 10);
  const { name, start_at, end_at, is_active } = req.body;

  const existingSeason = db.prepare('SELECT id FROM season WHERE id = ?').get(seasonId);
  if (!existingSeason) {
    return res.status(404).json({ error: 'Season not found' });
  }

  try {
    // If setting as active, deactivate other seasons first
    if (is_active) {
      db.prepare('UPDATE season SET is_active = 0').run();
    }

    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (start_at !== undefined) {
      updates.push('start_at = ?');
      values.push(start_at);
    }
    if (end_at !== undefined) {
      updates.push('end_at = ?');
      values.push(end_at);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(seasonId);
    db.prepare(`UPDATE season SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updatedSeason = db.prepare('SELECT id, name, start_at, end_at, is_active FROM season WHERE id = ?').get(seasonId);
    res.json(updatedSeason);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update season', details: error.message });
  }
});

// Delete a season
app.delete('/admin/seasons/:id', requireAdmin, (req, res) => {
  const seasonId = parseInt(req.params.id, 10);

  const existingSeason = db.prepare('SELECT id FROM season WHERE id = ?').get(seasonId);
  if (!existingSeason) {
    return res.status(404).json({ error: 'Season not found' });
  }

  // Check if season has weeks
  const weekCount = db.prepare('SELECT COUNT(*) as count FROM week WHERE season_id = ?').get(seasonId);
  if (weekCount.count > 0) {
    return res.status(400).json({ 
      error: 'Cannot delete season with existing weeks',
      weeks_count: weekCount.count
    });
  }

  try {
    db.prepare('DELETE FROM season WHERE id = ?').run(seasonId);
    res.json({ message: 'Season deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete season', details: error.message });
  }
});

// ========================================
// ADMIN ENDPOINTS - Week Management
// ========================================

// Create a new week
app.post('/admin/weeks', requireAdmin, (req, res) => {
  console.log('POST /admin/weeks - Request body:', JSON.stringify(req.body, null, 2));
  
  const { season_id, week_name, segment_id, segment_name, required_laps, start_at, end_at } = req.body;

  // Auto-select active season if not provided
  let finalSeasonId = season_id;
  if (!finalSeasonId) {
    const activeSeason = db.prepare('SELECT id FROM season WHERE is_active = 1 LIMIT 1').get();
    if (!activeSeason) {
      console.error('No active season found');
      return res.status(400).json({ 
        error: 'No active season found',
        message: 'Please create an active season first or provide season_id'
      });
    }
    finalSeasonId = activeSeason.id;
    console.log('Using active season:', finalSeasonId);
  }

  // Validate required fields (all in Unix timestamp format now)
  if (!week_name || !segment_id || !required_laps || start_at === undefined || end_at === undefined) {
    console.error('Missing required fields:', { week_name, segment_id, required_laps, start_at, end_at });
    return res.status(400).json({ 
      error: 'Missing required fields',
      required: ['week_name', 'segment_id', 'required_laps', 'start_at', 'end_at'],
      received: { week_name, segment_id, required_laps, start_at, end_at }
    });
  }

  // Validate season exists
  const season = db.prepare('SELECT id FROM season WHERE id = ?').get(finalSeasonId);
  if (!season) {
    console.error('Invalid season_id:', finalSeasonId);
    return res.status(400).json({ error: 'Invalid season_id' });
  }

  // Ensure segment exists (segment_id is now Strava segment ID)
  if (segment_id) {
    // Check if segment already exists
    const existingSegment = db.prepare('SELECT strava_segment_id FROM segment WHERE strava_segment_id = ?').get(segment_id);
    if (!existingSegment) {
      // Segment doesn't exist - create it
      // If segment_name provided, use it; otherwise use segment_id as name
      const segmentName = segment_name || `Segment ${segment_id}`;
      console.log('Creating new segment:', segment_id, segmentName);
      db.prepare(`
        INSERT INTO segment (strava_segment_id, name)
        VALUES (?, ?)
      `).run(segment_id, segmentName);
    }
  } else {
    return res.status(400).json({ error: 'segment_id is required' });
  }

  try {
    console.log('Inserting week:', { 
      season_id: finalSeasonId, 
      week_name, 
      segment_id: segment_id, 
      required_laps, 
      start_at, 
      end_at 
    });
    
    const result = db.prepare(`
      INSERT INTO week (season_id, week_name, strava_segment_id, required_laps, start_at, end_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(finalSeasonId, week_name, segment_id, required_laps, start_at, end_at);

    const newWeek = db.prepare(`
      SELECT w.id, w.season_id, w.week_name, w.strava_segment_id as segment_id, w.required_laps, 
             w.start_at, w.end_at, s.name as segment_name
      FROM week w
      LEFT JOIN segment s ON w.strava_segment_id = s.strava_segment_id
      WHERE w.id = ?
    `).get(result.lastInsertRowid);

    console.log('Week created successfully:', newWeek);
    res.status(201).json(newWeek);
  } catch (error) {
    console.error('Failed to create week:', error);
    res.status(500).json({ error: 'Failed to create week', details: error.message });
  }
});

// Update an existing week
app.put('/admin/weeks/:id', requireAdmin, (req, res) => {
  const weekId = parseInt(req.params.id, 10);
  // Accept both old (date, start_time, end_time) and new (start_at, end_at) parameters for backwards compatibility
  const { season_id, week_name, date, segment_id, required_laps, start_time, end_time, start_at, end_at } = req.body;

  // Check if week exists
  const existingWeek = db.prepare('SELECT id FROM week WHERE id = ?').get(weekId);
  if (!existingWeek) {
    return res.status(404).json({ error: 'Week not found' });
  }

  // Check if any updates are provided
  const hasUpdates = season_id !== undefined || week_name !== undefined || date !== undefined || segment_id !== undefined || 
                     required_laps !== undefined || start_time !== undefined || end_time !== undefined || 
                     start_at !== undefined || end_at !== undefined;
  if (!hasUpdates) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  // Build dynamic update query
  const updates = [];
  const values = [];

  if (season_id !== undefined) {
    const season = db.prepare('SELECT id FROM season WHERE id = ?').get(season_id);
    if (!season) {
      return res.status(400).json({ error: 'Invalid season_id' });
    }
    updates.push('season_id = ?');
    values.push(season_id);
  }

  if (week_name !== undefined) {
    updates.push('week_name = ?');
    values.push(week_name);
  }

  // Handle timestamp updates (support both old and new parameter names)
  if (start_at !== undefined) {
    const unixSeconds = typeof start_at === 'string' ? isoToUnix(start_at) : start_at;
    updates.push('start_at = ?');
    values.push(unixSeconds);
  } else if (start_time !== undefined) {
    // Old parameter name for backwards compatibility
    const normalized = normalizeTimeWithZ(start_time);
    const unixSeconds = isoToUnix(normalized);
    updates.push('start_at = ?');
    values.push(unixSeconds);
  } else if (date !== undefined && (req.body.start_time === undefined && req.body.start_at === undefined)) {
    // If only date is provided (and no explicit time), compute start_at as midnight on that date
    const window = defaultDayTimeWindow(date);
    const startAtUnix = isoToUnix(window.start);
    updates.push('start_at = ?');
    values.push(startAtUnix);
  }

  if (end_at !== undefined) {
    const unixSeconds = typeof end_at === 'string' ? isoToUnix(end_at) : end_at;
    updates.push('end_at = ?');
    values.push(unixSeconds);
  } else if (end_time !== undefined) {
    // Old parameter name for backwards compatibility
    const normalized = normalizeTimeWithZ(end_time);
    const unixSeconds = isoToUnix(normalized);
    updates.push('end_at = ?');
    values.push(unixSeconds);
  } else if (date !== undefined && (req.body.end_time === undefined && req.body.end_at === undefined)) {
    // If only date is provided (and no explicit time), compute end_at as 10pm on that date
    const window = defaultDayTimeWindow(date);
    const endAtUnix = isoToUnix(window.end);
    updates.push('end_at = ?');
    values.push(endAtUnix);
  }
  if (segment_id !== undefined) {
    if (req.body.segment_name !== undefined) {
      // segment_id with segment_name: Upsert the segment
      const existingSegment = db.prepare('SELECT strava_segment_id FROM segment WHERE strava_segment_id = ?').get(segment_id);
      if (existingSegment) {
        // Update existing segment name
        db.prepare(`
          UPDATE segment 
          SET name = ?
          WHERE strava_segment_id = ?
        `).run(req.body.segment_name, segment_id);
      } else {
        // Insert new segment
        db.prepare(`
          INSERT INTO segment (strava_segment_id, name)
          VALUES (?, ?)
        `).run(segment_id, req.body.segment_name);
      }
      
      // Update week to point to this Strava segment ID
      updates.push('strava_segment_id = ?');
      values.push(segment_id);
    } else {
      // segment_id without segment_name: Must exist in database
      const existingSegment = db.prepare('SELECT strava_segment_id FROM segment WHERE strava_segment_id = ?').get(segment_id);
      if (!existingSegment) {
        return res.status(400).json({ 
          error: 'Invalid segment_id',
          message: 'Segment does not exist. Provide segment_name to create it, or use an existing segment.'
        });
      }
      updates.push('strava_segment_id = ?');
      values.push(segment_id);
    }
  }
  if (required_laps !== undefined) {
    updates.push('required_laps = ?');
    values.push(required_laps);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(weekId);

  try {
    db.prepare(`
      UPDATE week 
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...values);

    const updatedWeek = db.prepare(`
      SELECT id, week_name, strava_segment_id as segment_id, required_laps, start_at, end_at
      FROM week WHERE id = ?
    `).get(weekId);

    res.json(updatedWeek);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update week', details: error.message });
  }
});

// Delete a week (and cascade delete activities, efforts, results)
app.delete('/admin/weeks/:id', requireAdmin, (req, res) => {
  const weekId = parseInt(req.params.id, 10);

  // Check if week exists
  const existingWeek = db.prepare('SELECT id FROM week WHERE id = ?').get(weekId);
  if (!existingWeek) {
    return res.status(404).json({ error: 'Week not found' });
  }

  try {
    db.transaction(() => {
      // Get all activities for this week
      const activities = db.prepare('SELECT id FROM activity WHERE week_id = ?').all(weekId);
      const activityIds = activities.map(a => a.id);

      // Delete segment efforts for these activities
      if (activityIds.length > 0) {
        const placeholders = activityIds.map(() => '?').join(',');
        db.prepare(`DELETE FROM segment_effort WHERE activity_id IN (${placeholders})`).run(...activityIds);
      }

      // Delete results for this week
      db.prepare('DELETE FROM result WHERE week_id = ?').run(weekId);

      // Delete activities for this week
      db.prepare('DELETE FROM activity WHERE week_id = ?').run(weekId);

      // Delete the week itself
      db.prepare('DELETE FROM week WHERE id = ?').run(weekId);
    })();

    res.json({ message: 'Week deleted successfully', weekId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete week', details: error.message });
  }
});

// Admin batch fetch results for a week
app.post('/admin/weeks/:id/fetch-results', requireAdmin, async (req, res) => {
  const weekId = parseInt(req.params.id, 10);
  
  try {
    // Get week details including segment info
    // NEW SCHEMA: start_at and end_at are already INTEGER Unix seconds (UTC)
    const week = db.prepare(`
      SELECT w.*, s.strava_segment_id, s.name as segment_name
      FROM week w
      JOIN segment s ON w.strava_segment_id = s.strava_segment_id
      WHERE w.id = ?
    `).get(weekId);
    
    if (!week) {
      return res.status(404).json({ error: 'Week not found' });
    }
    
    // ===== WEEK TIME CONTEXT =====
    console.log('\n[Batch Fetch] ========== WEEK TIME CONTEXT ==========');
    console.log(`[Batch Fetch] Week: ID=${week.id}, Name='${week.week_name}'`);
    console.log(`[Batch Fetch] Segment: ID=${week.strava_segment_id}, Name='${week.segment_name}'`);
    console.log(`[Batch Fetch] Required laps: ${week.required_laps}`);
    console.log('[Batch Fetch] Time window (Unix seconds UTC):');
    console.log(`  start_at: ${week.start_at} (${unixToISO(week.start_at)})`);
    console.log(`  end_at: ${week.end_at} (${unixToISO(week.end_at)})`);
    console.log(`[Batch Fetch] Window duration: ${week.end_at - week.start_at} seconds (${(week.end_at - week.start_at) / 3600} hours)`);
    console.log('[Batch Fetch] ========== END WEEK CONTEXT ==========\n');
    
    // Use Unix times directly (no conversion needed)
    const startUnix = week.start_at;
    const endUnix = week.end_at;
    
    // Get all connected participants (those with valid tokens)
    const participants = db.prepare(`
      SELECT p.strava_athlete_id, p.name, pt.access_token
      FROM participant p
      JOIN participant_token pt ON p.strava_athlete_id = pt.strava_athlete_id
      WHERE pt.access_token IS NOT NULL
    `).all();
    
    if (participants.length === 0) {
      return res.json({
        message: 'No participants connected',
        week_id: weekId,
        participants_processed: 0,
        results_found: 0,
        summary: []
      });
    }
    
    const results = [];
    
    // Process each participant
    for (const participant of participants) {
      try {
        console.log(`\n[Batch Fetch] Processing ${participant.name} (Strava ID: ${participant.strava_athlete_id})`);
        
        // Get valid token (auto-refreshes if needed)
        const accessToken = await getValidAccessToken(db, stravaClient, participant.strava_athlete_id);
        
        // Fetch activities using Unix timestamps (already UTC)
        const activities = await stravaClient.listAthleteActivities(
          accessToken,
          startUnix,  // Unix timestamp for UTC start
          endUnix,    // Unix timestamp for UTC end
          { includeAllEfforts: true }
        );
        
        console.log(`[Batch Fetch] Found ${activities.length} total activities within time window`);
        if (activities.length > 0) {
          console.log(`[Batch Fetch] Activities for ${participant.name}:`);
          for (const act of activities) {
            console.log(`  - ID: ${act.id}, Strava ID: ${act.strava_activity_id}, Start: ${act.start_at}`);
          }
        }
        
        // Find best qualifying activity
        console.log(`[Batch Fetch] Searching for segment ${week.strava_segment_id} (${week.segment_name}), require ${week.required_laps} lap(s)`);
        const bestActivity = await findBestQualifyingActivity(
          activities,
          week.strava_segment_id,
          week.required_laps,
          accessToken,
          week  // Pass week for time window validation
        );
        
        if (bestActivity) {
          console.log(`[Batch Fetch] ✓ SUCCESS for ${participant.name}: Activity '${bestActivity.name}' (ID: ${bestActivity.id}, Time: ${Math.round(bestActivity.totalTime / 60)}min, Device: '${bestActivity.device_name || 'unknown'}')`);
          
          // Store activity and efforts
          storeActivityAndEfforts(db, participant.strava_athlete_id, weekId, bestActivity, week.strava_segment_id);
          
          results.push({
            participant_id: participant.strava_athlete_id,
            participant_name: participant.name,
            activity_found: true,
            activity_id: bestActivity.id,
            total_time: bestActivity.totalTime,
            segment_efforts: bestActivity.segmentEfforts.length
          });
        } else {
          console.log(`[Batch Fetch] ✗ No qualifying activities found for ${participant.name}`);
          results.push({
            participant_id: participant.strava_athlete_id,
            participant_name: participant.name,
            activity_found: false,
            reason: 'No qualifying activities on event day'
          });
        }
      } catch (error) {
        // Better error logging for diagnostics
        const errorMsg = error.message || String(error);
        console.error(`Error processing ${participant.name}:`, errorMsg);
        if (error.stack) {
          console.error('Stack trace:', error.stack);
        }
        if (error.errors && Array.isArray(error.errors)) {
          console.error('Sub-errors:', error.errors.map(e => e.message || String(e)));
        }
        
        results.push({
          participant_id: participant.strava_athlete_id,
          participant_name: participant.name,
          activity_found: false,
          reason: errorMsg
        });
      }
    }
    
    // Note: Scores are computed dynamically on read, not stored
    // See GET /weeks/:id/leaderboard and GET /season/leaderboard
    
    console.log(`Fetch results complete for week ${weekId}: ${results.filter(r => r.activity_found).length}/${participants.length} activities found`);
    
    res.json({
      message: 'Results fetched successfully',
      week_id: weekId,
      week_name: week.week_name,
      participants_processed: participants.length,
      results_found: results.filter(r => r.activity_found).length,
      summary: results
    });
    
  } catch (error) {
    console.error('Batch fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch results',
      details: error.message
    });
  }
});

// Get all participants with connection status (admin endpoint)
app.get('/admin/participants', requireAdmin, (req, res) => {
  try {
    const participants = db.prepare(`
      SELECT 
        p.strava_athlete_id as id,
        p.name,
        p.strava_athlete_id,
        CASE WHEN pt.access_token IS NOT NULL THEN 1 ELSE 0 END as has_token,
        pt.expires_at as token_expires_at
      FROM participant p
      LEFT JOIN participant_token pt ON p.strava_athlete_id = pt.strava_athlete_id
      ORDER BY p.name
    `).all();
    
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
