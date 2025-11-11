const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const Database = require('better-sqlite3');
const session = require('express-session');
const SqliteStore = require('better-sqlite3-session-store')(session);
const strava = require('strava-v3');
const { encryptToken, decryptToken } = require('./encryption');

dotenv.config();

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
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'wmv.db');

const app = express();
// Enable CORS for frontend - use CLIENT_BASE_URL environment variable
app.use(cors({ 
  origin: CLIENT_BASE_URL,
  credentials: true // Important: allow cookies to be sent
}));
app.use(express.json());

// Session configuration for OAuth
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax', // More permissive in dev
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
};

// Only use persistent session store in non-test environments
// In test mode, use default MemoryStore to avoid open database handles
if (process.env.NODE_ENV !== 'test') {
  sessionConfig.store = new SqliteStore({
    client: new Database(path.join(__dirname, '..', 'data', 'sessions.db')),
    expired: {
      clear: true,
      intervalMs: 900000 // Clear expired sessions every 15 minutes
    }
  });
}

app.use(session(sessionConfig));

// Initialize DB
const db = new Database(DB_PATH);

// Create tables with updated schema v2.0
db.exec(`
CREATE TABLE IF NOT EXISTS seasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  is_active BOOLEAN DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS participants (
  strava_athlete_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS segments (
  strava_segment_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  distance REAL,
  average_grade REAL,
  city TEXT,
  state TEXT,
  country TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS weeks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL,
  week_name TEXT NOT NULL,
  date TEXT NOT NULL,
  segment_id INTEGER NOT NULL,
  required_laps INTEGER NOT NULL DEFAULT 1,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(season_id) REFERENCES seasons(id),
  FOREIGN KEY(segment_id) REFERENCES segments(strava_segment_id)
);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_id INTEGER NOT NULL,
  strava_athlete_id INTEGER NOT NULL,
  strava_activity_id INTEGER NOT NULL,
  activity_url TEXT NOT NULL,
  activity_date TEXT NOT NULL,
  validation_status TEXT DEFAULT 'valid',
  validation_message TEXT,
  validated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(week_id) REFERENCES weeks(id),
  FOREIGN KEY(strava_athlete_id) REFERENCES participants(strava_athlete_id),
  UNIQUE(week_id, strava_athlete_id)
);

CREATE TABLE IF NOT EXISTS segment_efforts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id INTEGER NOT NULL,
  segment_id INTEGER NOT NULL,
  effort_index INTEGER NOT NULL,
  elapsed_seconds INTEGER NOT NULL,
  start_time TEXT,
  pr_achieved BOOLEAN DEFAULT 0,
  FOREIGN KEY(activity_id) REFERENCES activities(id),
  FOREIGN KEY(segment_id) REFERENCES segments(strava_segment_id)
);

CREATE TABLE IF NOT EXISTS results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_id INTEGER NOT NULL,
  strava_athlete_id INTEGER NOT NULL,
  activity_id INTEGER,
  total_time_seconds INTEGER NOT NULL,
  rank INTEGER,
  points INTEGER,
  pr_bonus_points INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(week_id) REFERENCES weeks(id),
  FOREIGN KEY(strava_athlete_id) REFERENCES participants(strava_athlete_id),
  FOREIGN KEY(activity_id) REFERENCES activities(id),
  UNIQUE(week_id, strava_athlete_id)
);

CREATE TABLE IF NOT EXISTS participant_tokens (
  strava_athlete_id INTEGER PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  scope TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(strava_athlete_id) REFERENCES participants(strava_athlete_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_activities_week_participant ON activities(week_id, strava_athlete_id);
CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(validation_status);
CREATE INDEX IF NOT EXISTS idx_segment_efforts_activity ON segment_efforts(activity_id);
CREATE INDEX IF NOT EXISTS idx_results_week ON results(week_id);
CREATE INDEX IF NOT EXISTS idx_results_participant ON results(strava_athlete_id);
CREATE INDEX IF NOT EXISTS idx_participant_tokens_participant ON participant_tokens(strava_athlete_id);
CREATE INDEX IF NOT EXISTS idx_weeks_season ON weeks(season_id);
CREATE INDEX IF NOT EXISTS idx_seasons_active ON seasons(is_active);
`);

// Validate activity time window
function validateActivityTimeWindow(activityDate, week) {
  const activityTime = new Date(activityDate);
  const startTime = new Date(week.start_time);
  const endTime = new Date(week.end_time);

  if (activityTime < startTime || activityTime > endTime) {
    return {
      valid: false,
      message: `Activity must be completed between ${startTime.toISOString()} and ${endTime.toISOString()}. Your activity was at ${activityTime.toISOString()}.`
    };
  }

  return {
    valid: true,
    message: 'Activity time is within the allowed window'
  };
}

// Calculate results and rankings for a week
function calculateWeekResults(weekId) {
  // Get all valid activities for this week with summed segment efforts and PR info
  const activities = db.prepare(`
    SELECT 
      a.id as activity_id,
      a.strava_athlete_id,
      SUM(se.elapsed_seconds) as total_time_seconds,
      MAX(se.pr_achieved) as achieved_pr
    FROM activities a
    JOIN segment_efforts se ON a.id = se.activity_id
    WHERE a.week_id = ? AND a.validation_status = 'valid'
    GROUP BY a.id, a.strava_athlete_id
    ORDER BY total_time_seconds ASC
  `).all(weekId);

  if (activities.length === 0) return;

  const totalParticipants = activities.length;
  
  // Delete existing results for this week
  db.prepare('DELETE FROM results WHERE week_id = ?').run(weekId);

  // Insert new results with correct scoring: points = (number of people you beat + 1 for competing) + PR bonus
  const insertResult = db.prepare(`
    INSERT INTO results (week_id, strava_athlete_id, activity_id, total_time_seconds, rank, points, pr_bonus_points)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    activities.forEach((activity, index) => {
      const rank = index + 1;
      const basePoints = (totalParticipants - rank) + 1; // Beat everyone ranked below you + 1 for competing
      const prBonus = activity.achieved_pr ? 1 : 0; // +1 point if any PR was achieved
      const totalPoints = basePoints + prBonus;
      
      insertResult.run(
        weekId,
        activity.strava_athlete_id,
        activity.activity_id,
        activity.total_time_seconds,
        rank,
        totalPoints,
        prBonus
      );
    });
  })();

  console.log(`Results calculated for week ${weekId}: ${activities.length} participants`);
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Get a valid access token for a participant, refreshing if needed
 * @param {number} stravaAthleteId - The participant's Strava athlete ID
 * @returns {Promise<string>} Valid access token
 */
async function getValidAccessToken(stravaAthleteId) {
  const tokenRecord = db.prepare(`
    SELECT * FROM participant_tokens WHERE strava_athlete_id = ?
  `).get(stravaAthleteId);
  
  if (!tokenRecord) {
    throw new Error('Participant not connected to Strava');
  }
  
  // Decrypt the stored refresh token (for checking expiry and refresh)
  let refreshToken = tokenRecord.refresh_token;
  try {
    refreshToken = decryptToken(tokenRecord.refresh_token);
  } catch (error) {
    console.warn(`Failed to decrypt refresh token for ${stravaAthleteId}. May be plaintext from before encryption: ${error.message}`);
    // If decryption fails, assume it's plaintext (migration case)
  }
  
  const now = Math.floor(Date.now() / 1000);  // Current Unix timestamp
  
  // Token expires in less than 1 hour? Refresh it proactively
  if (tokenRecord.expires_at < (now + 3600)) {
    console.log(`Token expiring soon for participant ${stravaAthleteId}, refreshing...`);
    
    try {
      // Use strava-v3 to refresh the token
      const newTokenData = await strava.oauth.refreshToken(refreshToken);
      
      // Update database with NEW tokens (both access and refresh tokens change!)
      // Store encrypted
      db.prepare(`
        UPDATE participant_tokens 
        SET access_token = ?,
            refresh_token = ?,
            expires_at = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE strava_athlete_id = ?
      `).run(
        encryptToken(newTokenData.access_token),
        encryptToken(newTokenData.refresh_token),
        newTokenData.expires_at,
        stravaAthleteId
      );
      
      // Return the plaintext access token (kept in memory for use)
      return newTokenData.access_token;
    } catch (error) {
      throw new Error(`Failed to refresh token: ${error.message}`);
    }
  }
  
  // Token still valid, decrypt and return it
  try {
    const accessToken = decryptToken(tokenRecord.access_token);
    return accessToken;
  } catch (error) {
    console.warn(`Failed to decrypt access token for ${stravaAthleteId}. May be plaintext from before encryption: ${error.message}`);
    // If decryption fails, assume it's plaintext (migration case)
    return tokenRecord.access_token;
  }
}

/**
 * Fetch activity details from Strava API using strava-v3
 * @param {string} activityId - Strava activity ID
 * @param {string} accessToken - Valid Strava access token
 * @returns {Promise<Object>} Activity data from Strava
 */
async function fetchStravaActivity(activityId, accessToken) {
  try {
    // Create a client with the user's access token
    const client = new strava.client(accessToken);
    
    // Fetch the activity
    const activity = await client.activities.get({ id: activityId });
    
    return activity;
  } catch (error) {
    // Handle strava-v3 specific errors
    if (error.statusCode === 404) {
      throw new Error('Activity not found on Strava');
    } else if (error.statusCode === 401) {
      throw new Error('Invalid or expired Strava token');
    }
    throw new Error(`Strava API error: ${error.message}`);
  }
}

/**
 * Extract activity ID from Strava URL
 * @param {string} url - Strava activity URL
 * @returns {string|null} Activity ID or null if invalid
 */
function extractActivityId(url) {
  // Matches: https://www.strava.com/activities/12345678
  const match = url.match(/strava\.com\/activities\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Fetch activities from Strava within a time window
 * @param {string} accessToken - Valid Strava access token
 * @param {string} startTime - ISO 8601 start time
 * @param {string} endTime - ISO 8601 end time
 * @returns {Promise<Array>} Activities from Strava
 */
async function fetchActivitiesOnDay(accessToken, startTime, endTime) {
  try {
    const client = new strava.client(accessToken);
    
    // Convert to Unix timestamps
    const after = Math.floor(new Date(startTime).getTime() / 1000);
    const before = Math.floor(new Date(endTime).getTime() / 1000);
    
    const activities = await client.athlete.listActivities({
      after: after,
      before: before,
      per_page: 100 // Should be plenty for one day
    });
    
    return activities || [];
  } catch (error) {
    throw new Error(`Failed to fetch activities: ${error.message}`);
  }
}

/**
 * Find the best qualifying activity with required segment repetitions
 * @param {Array} activities - List of activities from Strava
 * @param {number} segmentId - Strava segment ID to look for
 * @param {number} requiredLaps - Required number of repetitions
 * @param {string} accessToken - Valid Strava access token
 * @returns {Promise<Object|null>} Best activity or null if none qualify
 */
async function findBestQualifyingActivity(activities, segmentId, requiredLaps, accessToken) {
  const client = new strava.client(accessToken);
  let bestActivity = null;
  let bestTime = Infinity;
  
  for (const activity of activities) {
    try {
      // Fetch full activity details (includes segment efforts)
      const fullActivity = await client.activities.get({ id: activity.id });
      
      // Filter to segment efforts matching our segment
      const matchingEfforts = (fullActivity.segment_efforts || []).filter(
        effort => effort.segment.id.toString() === segmentId.toString()
      );
      
      // Check if activity has required number of repetitions
      if (matchingEfforts.length >= requiredLaps) {
        // Calculate total time (sum of fastest N laps if more than required)
        const sortedEfforts = matchingEfforts
          .sort((a, b) => a.elapsed_time - b.elapsed_time)
          .slice(0, requiredLaps);
        
        const totalTime = sortedEfforts.reduce((sum, e) => sum + e.elapsed_time, 0);
        
        if (totalTime < bestTime) {
          bestTime = totalTime;
          bestActivity = {
            id: fullActivity.id,
            start_date_local: fullActivity.start_date_local,
            totalTime: totalTime,
            segmentEfforts: sortedEfforts,
            activity_url: `https://www.strava.com/activities/${fullActivity.id}`
          };
        }
      }
    } catch (error) {
      console.error(`Failed to fetch activity ${activity.id}:`, error.message);
      // Continue to next activity
    }
  }
  
  return bestActivity;
}

/**
 * Store activity and segment efforts in database (replaces existing if present)
 * @param {number} stravaAthleteId - Strava athlete ID
 * @param {number} weekId - Week ID
 * @param {Object} activityData - Activity data with segmentEfforts
 * @param {number} stravaSegmentId - Strava segment ID (now used directly)
 */
function storeActivityAndEfforts(stravaAthleteId, weekId, activityData, stravaSegmentId) {
  // Delete existing activity for this participant/week if exists
  const existing = db.prepare(`
    SELECT id FROM activities WHERE week_id = ? AND strava_athlete_id = ?
  `).get(weekId, stravaAthleteId);
  
  if (existing) {
    db.prepare('DELETE FROM results WHERE activity_id = ?').run(existing.id);
    db.prepare('DELETE FROM segment_efforts WHERE activity_id = ?').run(existing.id);
    db.prepare('DELETE FROM activities WHERE id = ?').run(existing.id);
  }
  
  // Extract date from start_date_local
  const activityDate = activityData.start_date_local.split('T')[0];
  
  // Store new activity
  const activityResult = db.prepare(`
    INSERT INTO activities (week_id, strava_athlete_id, strava_activity_id, activity_url, activity_date, validation_status)
    VALUES (?, ?, ?, ?, ?, 'valid')
  `).run(weekId, stravaAthleteId, activityData.id, activityData.activity_url, activityDate);
  
  const activityDbId = activityResult.lastInsertRowid;
  
  // Store segment efforts
  console.log(`Storing ${activityData.segmentEfforts.length} segment efforts for activity ${activityDbId}`);
  for (let i = 0; i < activityData.segmentEfforts.length; i++) {
    const effort = activityData.segmentEfforts[i];
    console.log(`  Effort ${i}: segment_id=${stravaSegmentId}, elapsed_time=${effort.elapsed_time}`);
    db.prepare(`
      INSERT INTO segment_efforts (activity_id, segment_id, effort_index, elapsed_seconds, pr_achieved)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      activityDbId,
      stravaSegmentId,
      i,
      effort.elapsed_time,
      effort.pr_rank ? 1 : 0
    );
  }
  
  // Store result
  db.prepare(`
    INSERT OR REPLACE INTO results (week_id, strava_athlete_id, activity_id, total_time_seconds)
    VALUES (?, ?, ?, ?)
  `).run(weekId, stravaAthleteId, activityDbId, activityData.totalTime);
}

// ========================================
// STATIC FILE SERVING (Frontend)
// ========================================

// Serve built frontend from dist/ directory
app.use(express.static(path.join(__dirname, '../../dist')));

// Fallback to index.html for React Router SPA
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../dist/index.html'));
});

// ========================================
// AUTHENTICATION ROUTES
// ========================================

// GET /auth/strava - Initiate OAuth flow
app.get('/auth/strava', (req, res) => {
  const stravaAuthUrl = 'https://www.strava.com/oauth/authorize?' + 
    new URLSearchParams({
      client_id: process.env.STRAVA_CLIENT_ID,
      redirect_uri: process.env.STRAVA_REDIRECT_URI,
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
    // Exchange authorization code for tokens using strava-v3
    console.log('Exchanging OAuth code for tokens...');
    const tokenData = await strava.oauth.getToken(code);
    
    const stravaAthleteId = tokenData.athlete.id;
    const athleteName = `${tokenData.athlete.firstname} ${tokenData.athlete.lastname}`;
    
    console.log(`OAuth successful for Strava athlete ${stravaAthleteId} (${athleteName})`);
    
    // Upsert participant in database (using athlete ID as primary key)
    db.prepare(`
      INSERT INTO participants (strava_athlete_id, name)
      VALUES (?, ?)
      ON CONFLICT(strava_athlete_id) DO UPDATE SET name = excluded.name
    `).run(stravaAthleteId, athleteName);
    
    console.log(`Participant record ensured for ${athleteName}`);
    
    // Store tokens for this participant (ENCRYPTED)
    db.prepare(`
      INSERT OR REPLACE INTO participant_tokens 
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
    
    // Redirect to dashboard
    res.redirect(`${CLIENT_BASE_URL}?connected=true`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`${CLIENT_BASE_URL}?error=server_error`);
  }
});

// GET /auth/status - Check authentication status
app.get('/auth/status', (req, res) => {
  if (req.session.stravaAthleteId) {
    const participant = db.prepare(`
      SELECT p.strava_athlete_id, p.name,
             CASE WHEN pt.strava_athlete_id IS NOT NULL THEN 1 ELSE 0 END as is_connected
      FROM participants p
      LEFT JOIN participant_tokens pt ON p.strava_athlete_id = pt.strava_athlete_id
      WHERE p.strava_athlete_id = ?
    `).get(req.session.stravaAthleteId);
    
    res.json({
      authenticated: true,
      participant: participant
    });
  } else {
    res.json({
      authenticated: false,
      participant: null
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
  db.prepare('DELETE FROM participant_tokens WHERE strava_athlete_id = ?').run(stravaAthleteId);
  
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
// PUBLIC ROUTES
// ========================================

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/participants', (req, res) => {
  const rows = db.prepare('SELECT id, name, strava_athlete_id FROM participants').all();
  res.json(rows);
});

app.get('/segments', (req, res) => {
  const rows = db.prepare('SELECT strava_segment_id, name FROM segments').all();
  res.json(rows);
});

// ========================================
// SEASONS ENDPOINTS
// ========================================

app.get('/seasons', (req, res) => {
  const seasons = db.prepare('SELECT id, name, start_date, end_date, is_active FROM seasons ORDER BY start_date DESC').all();
  res.json(seasons);
});

app.get('/seasons/:id', (req, res) => {
  const seasonId = parseInt(req.params.id, 10);
  const season = db.prepare('SELECT id, name, start_date, end_date, is_active FROM seasons WHERE id = ?').get(seasonId);
  if (!season) return res.status(404).json({ error: 'Season not found' });
  res.json(season);
});

app.get('/seasons/:id/leaderboard', (req, res) => {
  const seasonId = parseInt(req.params.id, 10);
  
  const season = db.prepare('SELECT id, name, start_date, end_date FROM seasons WHERE id = ?').get(seasonId);
  if (!season) return res.status(404).json({ error: 'Season not found' });

  const seasonResults = db.prepare(`
    SELECT 
      p.strava_athlete_id as id,
      p.name,
      COALESCE(SUM(CASE WHEN w.season_id = ? THEN r.points ELSE 0 END), 0) as total_points,
      COUNT(CASE WHEN w.season_id = ? THEN r.id ELSE NULL END) as weeks_completed
    FROM participants p
    LEFT JOIN results r ON p.strava_athlete_id = r.strava_athlete_id
    LEFT JOIN weeks w ON r.week_id = w.id
    GROUP BY p.strava_athlete_id, p.name
    HAVING weeks_completed > 0
    ORDER BY total_points DESC, weeks_completed DESC
  `).all(seasonId, seasonId);

  res.json({ season, leaderboard: seasonResults });
});

// ========================================
// WEEKS ENDPOINTS
// ========================================

app.get('/weeks', (req, res) => {
  const rows = db.prepare(`
    SELECT w.id, w.season_id, w.week_name, w.date, w.segment_id, w.required_laps, 
           w.start_time, w.end_time, s.name as segment_name, s.strava_segment_id
    FROM weeks w
    LEFT JOIN segments s ON w.segment_id = s.strava_segment_id
    ORDER BY w.date DESC
  `).all();
  res.json(rows);
});

app.get('/weeks/:id', (req, res) => {
  const weekId = parseInt(req.params.id, 10);
  const week = db.prepare(`
    SELECT w.id, w.season_id, w.week_name, w.date, w.segment_id, w.required_laps, 
           w.start_time, w.end_time, s.name as segment_name, s.strava_segment_id
    FROM weeks w
    LEFT JOIN segments s ON w.segment_id = s.strava_segment_id
    WHERE w.id = ?
  `).get(weekId);
  if (!week) return res.status(404).json({ error: 'Week not found' });
  res.json(week);
});

app.get('/weeks/:id/leaderboard', (req, res) => {
  const weekId = parseInt(req.params.id, 10);
  const week = db.prepare(`
    SELECT w.id, w.season_id, w.week_name, w.date, w.segment_id, w.required_laps, w.start_time, w.end_time,
           s.name as segment_name, s.strava_segment_id
    FROM weeks w
    LEFT JOIN segments s ON w.segment_id = s.strava_segment_id
    WHERE w.id = ?
  `).get(weekId);
  if (!week) return res.status(404).json({ error: 'Week not found' });

  const results = db.prepare(`
    SELECT 
      r.rank,
      r.strava_athlete_id as participant_id,
      p.name,
      r.total_time_seconds,
      r.points,
      r.pr_bonus_points,
      a.activity_url,
      a.activity_date
    FROM results r
    JOIN participants p ON r.strava_athlete_id = p.strava_athlete_id
    LEFT JOIN activities a ON r.activity_id = a.id
    WHERE r.week_id = ?
    ORDER BY r.rank ASC
  `).all(weekId);

  const leaderboard = results.map(r => ({
    rank: r.rank,
    participant_id: r.participant_id,
    name: r.name,
    total_time_seconds: r.total_time_seconds,
    time_hhmmss: new Date(r.total_time_seconds * 1000).toISOString().substring(11, 19),
    points: r.points,
    pr_bonus_points: r.pr_bonus_points,
    activity_url: r.activity_url,
    activity_date: r.activity_date
  }));

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
      a.activity_url,
      a.activity_date,
      a.validation_status,
      a.validation_message
    FROM activities a
    JOIN participants p ON a.strava_athlete_id = p.strava_athlete_id
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
      se.start_time,
      se.pr_achieved,
      s.name as segment_name
    FROM segment_efforts se
    JOIN segments s ON se.segment_id = s.strava_segment_id
    WHERE se.activity_id = ?
    ORDER BY se.effort_index ASC
  `).all(activityId);

  res.json(efforts);
});

app.get('/season/leaderboard', (req, res) => {
  // Get the active season, or fall back to all results if no active season
  const activeSeason = db.prepare('SELECT id FROM seasons WHERE is_active = 1 LIMIT 1').get();
  
  if (activeSeason) {
    // Use active season's leaderboard
    const seasonResults = db.prepare(`
      SELECT 
        p.strava_athlete_id as id,
        p.name,
        COALESCE(SUM(CASE WHEN w.season_id = ? THEN r.points ELSE 0 END), 0) as total_points,
        COUNT(CASE WHEN w.season_id = ? THEN r.id ELSE NULL END) as weeks_completed
      FROM participants p
      LEFT JOIN results r ON p.strava_athlete_id = r.strava_athlete_id
      LEFT JOIN weeks w ON r.week_id = w.id
      GROUP BY p.strava_athlete_id, p.name
      HAVING weeks_completed > 0
      ORDER BY total_points DESC, weeks_completed DESC
    `).all(activeSeason.id, activeSeason.id);
    
    res.json(seasonResults);
  } else {
    // No active season - return all-time results
    const seasonResults = db.prepare(`
      SELECT 
        p.strava_athlete_id as id,
        p.name,
        COALESCE(SUM(r.points), 0) as total_points,
        COUNT(r.id) as weeks_completed
      FROM participants p
      LEFT JOIN results r ON p.strava_athlete_id = r.strava_athlete_id
      GROUP BY p.strava_athlete_id, p.name
      ORDER BY total_points DESC, weeks_completed DESC
    `).all();
    
    res.json(seasonResults);
  }
});

// ========================================
// ADMIN ENDPOINTS - Season Management
// ========================================

// Create a new season
app.post('/admin/seasons', (req, res) => {
  const { name, start_date, end_date, is_active } = req.body;

  if (!name || !start_date || !end_date) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      required: ['name', 'start_date', 'end_date']
    });
  }

  try {
    // If setting as active, deactivate other seasons first
    if (is_active) {
      db.prepare('UPDATE seasons SET is_active = 0').run();
    }

    const result = db.prepare(`
      INSERT INTO seasons (name, start_date, end_date, is_active)
      VALUES (?, ?, ?, ?)
    `).run(name, start_date, end_date, is_active ? 1 : 0);

    const newSeason = db.prepare('SELECT id, name, start_date, end_date, is_active FROM seasons WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newSeason);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create season', details: error.message });
  }
});

// Update an existing season
app.put('/admin/seasons/:id', (req, res) => {
  const seasonId = parseInt(req.params.id, 10);
  const { name, start_date, end_date, is_active } = req.body;

  const existingSeason = db.prepare('SELECT id FROM seasons WHERE id = ?').get(seasonId);
  if (!existingSeason) {
    return res.status(404).json({ error: 'Season not found' });
  }

  try {
    // If setting as active, deactivate other seasons first
    if (is_active) {
      db.prepare('UPDATE seasons SET is_active = 0').run();
    }

    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (start_date !== undefined) {
      updates.push('start_date = ?');
      values.push(start_date);
    }
    if (end_date !== undefined) {
      updates.push('end_date = ?');
      values.push(end_date);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(seasonId);
    db.prepare(`UPDATE seasons SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updatedSeason = db.prepare('SELECT id, name, start_date, end_date, is_active FROM seasons WHERE id = ?').get(seasonId);
    res.json(updatedSeason);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update season', details: error.message });
  }
});

// Delete a season
app.delete('/admin/seasons/:id', (req, res) => {
  const seasonId = parseInt(req.params.id, 10);

  const existingSeason = db.prepare('SELECT id FROM seasons WHERE id = ?').get(seasonId);
  if (!existingSeason) {
    return res.status(404).json({ error: 'Season not found' });
  }

  // Check if season has weeks
  const weekCount = db.prepare('SELECT COUNT(*) as count FROM weeks WHERE season_id = ?').get(seasonId);
  if (weekCount.count > 0) {
    return res.status(400).json({ 
      error: 'Cannot delete season with existing weeks',
      weeks_count: weekCount.count
    });
  }

  try {
    db.prepare('DELETE FROM seasons WHERE id = ?').run(seasonId);
    res.json({ message: 'Season deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete season', details: error.message });
  }
});

// ========================================
// ADMIN ENDPOINTS - Week Management
// ========================================

// Create a new week
app.post('/admin/weeks', (req, res) => {
  console.log('POST /admin/weeks - Request body:', JSON.stringify(req.body, null, 2));
  
  const { season_id, week_name, date, segment_id, segment_name, required_laps, start_time, end_time } = req.body;

  // Auto-select active season if not provided
  let finalSeasonId = season_id;
  if (!finalSeasonId) {
    const activeSeason = db.prepare('SELECT id FROM seasons WHERE is_active = 1 LIMIT 1').get();
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

  // Extract date from start_time if not provided
  let finalDate = date;
  if (!finalDate && start_time) {
    finalDate = start_time.split('T')[0];
    console.log('Extracted date from start_time:', finalDate);
  }

  // Validate required fields
  if (!week_name || !finalDate || !segment_id || !required_laps) {
    console.error('Missing required fields:', { week_name, finalDate, segment_id, required_laps });
    return res.status(400).json({ 
      error: 'Missing required fields',
      required: ['week_name', 'date (or start_time)', 'segment_id', 'required_laps'],
      received: { week_name, date: finalDate, segment_id, required_laps }
    });
  }

  // Validate season exists
  const season = db.prepare('SELECT id FROM seasons WHERE id = ?').get(finalSeasonId);
  if (!season) {
    console.error('Invalid season_id:', finalSeasonId);
    return res.status(400).json({ error: 'Invalid season_id' });
  }

  // Default time window: midnight to 10pm on event date
  const defaultStartTime = start_time || `${finalDate}T00:00:00Z`;
  const defaultEndTime = end_time || `${finalDate}T22:00:00Z`;

  // Ensure segment exists (segment_id is now Strava segment ID)
  if (segment_name && segment_id) {
    // Upsert segment: insert if not exists
    const existingSegment = db.prepare('SELECT strava_segment_id FROM segments WHERE strava_segment_id = ?').get(segment_id);
    if (!existingSegment) {
      console.log('Creating new segment:', segment_id, segment_name);
      db.prepare(`
        INSERT INTO segments (strava_segment_id, name)
        VALUES (?, ?)
      `).run(segment_id, segment_name);
    }
  } else if (!segment_id) {
    return res.status(400).json({ error: 'segment_id is required' });
  } else {
    // segment_id provided without segment_name - must exist in database
    const existingSegment = db.prepare('SELECT strava_segment_id FROM segments WHERE strava_segment_id = ?').get(segment_id);
    if (!existingSegment) {
      console.error('Invalid segment_id:', segment_id);
      return res.status(400).json({ 
        error: 'Invalid segment_id',
        message: 'Segment does not exist. Provide segment_name to create it, or use an existing segment.'
      });
    }
  }

  try {
    console.log('Inserting week:', { 
      season_id: finalSeasonId, 
      week_name, 
      date: finalDate, 
      segment_id: segment_id, 
      required_laps, 
      start_time: defaultStartTime, 
      end_time: defaultEndTime 
    });
    
    const result = db.prepare(`
      INSERT INTO weeks (season_id, week_name, date, segment_id, required_laps, start_time, end_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(finalSeasonId, week_name, finalDate, segment_id, required_laps, defaultStartTime, defaultEndTime);

    const newWeek = db.prepare(`
      SELECT w.id, w.season_id, w.week_name, w.date, w.segment_id, w.required_laps, 
             w.start_time, w.end_time, s.name as segment_name, s.strava_segment_id
      FROM weeks w
      LEFT JOIN segments s ON w.segment_id = s.strava_segment_id
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
app.put('/admin/weeks/:id', (req, res) => {
  const weekId = parseInt(req.params.id, 10);
  const { season_id, week_name, date, segment_id, required_laps, start_time, end_time } = req.body;

  // Check if week exists
  const existingWeek = db.prepare('SELECT id FROM weeks WHERE id = ?').get(weekId);
  if (!existingWeek) {
    return res.status(404).json({ error: 'Week not found' });
  }

  // Build dynamic update query
  const updates = [];
  const values = [];

  if (season_id !== undefined) {
    const season = db.prepare('SELECT id FROM seasons WHERE id = ?').get(season_id);
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
  if (date !== undefined) {
    updates.push('date = ?');
    values.push(date);
  }
  if (segment_id !== undefined) {
    if (req.body.segment_name !== undefined) {
      // segment_id with segment_name: Upsert the segment
      const existingSegment = db.prepare('SELECT strava_segment_id FROM segments WHERE strava_segment_id = ?').get(segment_id);
      if (existingSegment) {
        // Update existing segment name
        db.prepare(`
          UPDATE segments 
          SET name = ?
          WHERE strava_segment_id = ?
        `).run(req.body.segment_name, segment_id);
      } else {
        // Insert new segment
        db.prepare(`
          INSERT INTO segments (strava_segment_id, name)
          VALUES (?, ?)
        `).run(segment_id, req.body.segment_name);
      }
      
      // Update week to point to this Strava segment ID
      updates.push('segment_id = ?');
      values.push(segment_id);
    } else {
      // segment_id without segment_name: Must exist in database
      const existingSegment = db.prepare('SELECT strava_segment_id FROM segments WHERE strava_segment_id = ?').get(segment_id);
      if (!existingSegment) {
        return res.status(400).json({ 
          error: 'Invalid segment_id',
          message: 'Segment does not exist. Provide segment_name to create it, or use an existing segment.'
        });
      }
      updates.push('segment_id = ?');
      values.push(segment_id);
    }
  }
  if (required_laps !== undefined) {
    updates.push('required_laps = ?');
    values.push(required_laps);
  }
  if (start_time !== undefined) {
    updates.push('start_time = ?');
    values.push(start_time);
  }
  if (end_time !== undefined) {
    updates.push('end_time = ?');
    values.push(end_time);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(weekId);

  try {
    db.prepare(`
      UPDATE weeks 
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...values);

    const updatedWeek = db.prepare(`
      SELECT id, week_name, date, segment_id, required_laps, start_time, end_time
      FROM weeks WHERE id = ?
    `).get(weekId);

    res.json(updatedWeek);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update week', details: error.message });
  }
});

// Delete a week (and cascade delete activities, efforts, results)
app.delete('/admin/weeks/:id', (req, res) => {
  const weekId = parseInt(req.params.id, 10);

  // Check if week exists
  const existingWeek = db.prepare('SELECT id FROM weeks WHERE id = ?').get(weekId);
  if (!existingWeek) {
    return res.status(404).json({ error: 'Week not found' });
  }

  try {
    db.transaction(() => {
      // Get all activities for this week
      const activities = db.prepare('SELECT id FROM activities WHERE week_id = ?').all(weekId);
      const activityIds = activities.map(a => a.id);

      // Delete segment efforts for these activities
      if (activityIds.length > 0) {
        const placeholders = activityIds.map(() => '?').join(',');
        db.prepare(`DELETE FROM segment_efforts WHERE activity_id IN (${placeholders})`).run(...activityIds);
      }

      // Delete results for this week
      db.prepare('DELETE FROM results WHERE week_id = ?').run(weekId);

      // Delete activities for this week
      db.prepare('DELETE FROM activities WHERE week_id = ?').run(weekId);

      // Delete the week itself
      db.prepare('DELETE FROM weeks WHERE id = ?').run(weekId);
    })();

    res.json({ message: 'Week deleted successfully', weekId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete week', details: error.message });
  }
});

// Admin batch fetch results for a week
app.post('/admin/weeks/:id/fetch-results', async (req, res) => {
  const weekId = parseInt(req.params.id, 10);
  
  try {
    // Get week details including segment info
    const week = db.prepare(`
      SELECT w.*, s.strava_segment_id, s.name as segment_name
      FROM weeks w
      JOIN segments s ON w.segment_id = s.strava_segment_id
      WHERE w.id = ?
    `).get(weekId);
    
    if (!week) {
      return res.status(404).json({ error: 'Week not found' });
    }
    
    // Get all connected participants (those with valid tokens)
    const participants = db.prepare(`
      SELECT p.strava_athlete_id, p.name, pt.access_token
      FROM participants p
      JOIN participant_tokens pt ON p.strava_athlete_id = pt.strava_athlete_id
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
        console.log(`Fetching activities for ${participant.name} (Strava ID: ${participant.strava_athlete_id})`);
        
        // Get valid token (auto-refreshes if needed)
        const accessToken = await getValidAccessToken(participant.strava_athlete_id);
        
        // Fetch activities from event day
        const activities = await fetchActivitiesOnDay(
          accessToken,
          week.start_time,
          week.end_time
        );
        
        console.log(`Found ${activities.length} activities for ${participant.name}`);
        
        // Find best qualifying activity
        const bestActivity = await findBestQualifyingActivity(
          activities,
          week.strava_segment_id,
          week.required_laps,
          accessToken
        );
        
        if (bestActivity) {
          console.log(`Best activity for ${participant.name}: ${bestActivity.id} (${bestActivity.totalTime}s)`);
          
          // Store activity and efforts
          storeActivityAndEfforts(participant.strava_athlete_id, weekId, bestActivity, week.segment_id);
          
          results.push({
            participant_id: participant.strava_athlete_id,
            participant_name: participant.name,
            activity_found: true,
            activity_id: bestActivity.id,
            activity_url: bestActivity.activity_url,
            total_time: bestActivity.totalTime,
            segment_efforts: bestActivity.segmentEfforts.length
          });
        } else {
          console.log(`No qualifying activities for ${participant.name}`);
          results.push({
            participant_id: participant.strava_athlete_id,
            participant_name: participant.name,
            activity_found: false,
            reason: 'No qualifying activities on event day'
          });
        }
      } catch (error) {
        console.error(`Error processing ${participant.name}:`, error.message);
        results.push({
          participant_id: participant.strava_athlete_id,
          participant_name: participant.name,
          activity_found: false,
          reason: error.message
        });
      }
    }
    
    // Recalculate leaderboard for this week
    calculateWeekResults(weekId);
    
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
app.get('/admin/participants', (req, res) => {
  try {
    const participants = db.prepare(`
      SELECT 
        p.strava_athlete_id as id,
        p.name,
        p.strava_athlete_id,
        CASE WHEN pt.access_token IS NOT NULL THEN 1 ELSE 0 END as has_token,
        pt.expires_at as token_expires_at
      FROM participants p
      LEFT JOIN participant_tokens pt ON p.strava_athlete_id = pt.strava_athlete_id
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
app.get('/admin/segments', (req, res) => {
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
      FROM segments
      ORDER BY name
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
app.post('/admin/segments', (req, res) => {
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
      INSERT INTO segments (strava_segment_id, name, distance, average_grade, city, state, country)
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
      FROM segments
      WHERE strava_segment_id = ?
    `).get(strava_segment_id);

    return res.status(201).json(saved);
  } catch (error) {
    console.error('Failed to upsert segment:', error);
    return res.status(500).json({ error: 'Failed to save segment', details: error.message });
  }
});

// Validate segment endpoint (checks if segment exists on Strava)
app.get('/admin/segments/:id/validate', async (req, res) => {
  const segmentId = req.params.id;
  
  try {
    // Get any connected participant's token to query Strava API
    const tokenRecord = db.prepare(`
      SELECT access_token, strava_athlete_id FROM participant_tokens LIMIT 1
    `).get();
    
    if (!tokenRecord) {
      return res.status(400).json({ 
        error: 'No connected participants available to validate segment' 
      });
    }
    
    const accessToken = await getValidAccessToken(tokenRecord.strava_athlete_id);
    const client = new strava.client(accessToken);
    
    // Try to fetch segment details from Strava
    const segment = await client.segments.get({ id: segmentId });
    
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

// Activity submission endpoint
app.post('/weeks/:id/submit-activity', async (req, res) => {
  const weekId = parseInt(req.params.id, 10);
  const { activity_url } = req.body;

  try {
    // Get participant from session
    const stravaAthleteId = req.session?.stravaAthleteId;
    if (!stravaAthleteId) {
      return res.status(401).json({ 
        error: 'Not authenticated',
        message: 'You must connect your Strava account first'
      });
    }

    // Validate activity URL
    if (!activity_url) {
      return res.status(400).json({ 
        error: 'Missing activity URL',
        message: 'Please provide a Strava activity URL'
      });
    }

    // Extract activity ID from URL
    const activityId = extractActivityId(activity_url);
    if (!activityId) {
      return res.status(400).json({ 
        error: 'Invalid activity URL',
        message: 'URL must be in format: https://www.strava.com/activities/12345678'
      });
    }

    // Get week details
    const week = db.prepare(`
      SELECT w.*, s.name as segment_name, s.strava_segment_id 
      FROM weeks w
      JOIN segments s ON w.segment_id = s.strava_segment_id
      WHERE w.id = ?
    `).get(weekId);

    if (!week) {
      return res.status(404).json({ error: 'Week not found' });
    }

    // Get valid access token for this participant
    let accessToken;
    try {
      accessToken = await getValidAccessToken(stravaAthleteId);
    } catch (error) {
      return res.status(401).json({ 
        error: 'Strava not connected',
        message: 'Please reconnect your Strava account',
        details: error.message
      });
    }

    // Fetch activity from Strava API
    let activity;
    try {
      activity = await fetchStravaActivity(activityId, accessToken);
    } catch (error) {
      return res.status(400).json({ 
        error: 'Failed to fetch activity',
        message: error.message
      });
    }

    // Validate activity date matches week's Tuesday
    const activityDate = activity.start_date_local.split('T')[0]; // YYYY-MM-DD
    if (activityDate !== week.date) {
      return res.status(400).json({ 
        error: 'Activity date mismatch',
        message: `Activity must be from ${week.date}, but this activity is from ${activityDate}`
      });
    }

    // Validate time window if specified
    if (week.start_time && week.end_time) {
      const timeValidation = validateActivityTimeWindow(activity.start_date_local, week);
      if (!timeValidation.valid) {
        return res.status(400).json({ 
          error: 'Activity outside time window',
          message: timeValidation.message
        });
      }
    }

    // Find segment efforts for the required segment
    const segmentEfforts = (activity.segment_efforts || []).filter(
      effort => effort.segment.id.toString() === week.strava_segment_id.toString()
    );

    if (segmentEfforts.length === 0) {
      return res.status(400).json({ 
        error: 'Segment not found',
        message: `This activity does not contain the required segment: ${week.segment_name}`
      });
    }

    // Validate required laps
    if (segmentEfforts.length < week.required_laps) {
      return res.status(400).json({ 
        error: 'Not enough laps',
        message: `This week requires ${week.required_laps} laps, but activity only has ${segmentEfforts.length}`
      });
    }

    // Check if activity already submitted
    const existingActivity = db.prepare(`
      SELECT id FROM activities 
      WHERE week_id = ? AND strava_athlete_id = ?
    `).get(weekId, stravaAthleteId);

    if (existingActivity) {
      // Delete existing submission to replace it
      db.prepare('DELETE FROM segment_efforts WHERE activity_id = ?').run(existingActivity.id);
      db.prepare('DELETE FROM activities WHERE id = ?').run(existingActivity.id);
    }

    // Store activity
    const activityResult = db.prepare(`
      INSERT INTO activities (week_id, strava_athlete_id, strava_activity_id, activity_url, activity_date)
      VALUES (?, ?, ?, ?, ?)
    `).run(weekId, stravaAthleteId, activityId, activity_url, activityDate);

    const activityDbId = activityResult.lastInsertRowid;

    // Store segment efforts (take required number of laps)
    for (let i = 0; i < week.required_laps; i++) {
      const effort = segmentEfforts[i];
      db.prepare(`
        INSERT INTO segment_efforts (activity_id, segment_id, effort_index, elapsed_seconds, pr_achieved)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        activityDbId,
        week.segment_id,
        i,
        effort.elapsed_time,
        effort.pr_rank ? 1 : 0  // pr_achieved if pr_rank exists
      );
    }

    // Recalculate leaderboard for this week
    calculateWeekResults(weekId);

    res.json({ 
      message: 'Activity submitted successfully',
      activity: {
        id: activityDbId,
        strava_activity_id: activityId,
        date: activityDate,
        laps: week.required_laps,
        segment: week.segment_name
      }
    });

  } catch (error) {
    console.error('Activity submission error:', error);
    res.status(500).json({ 
      error: 'Failed to submit activity',
      details: error.message
    });
  }
});

// ========================================
// UTILITY ENDPOINTS (Development/Admin)
// ========================================
// NOTE: These endpoints are commented out until Strava integration is fully implemented
// They require authenticated Strava access tokens and segment-utils.js

/*
// GET /utils/inspect-activity/:id - Inspect a Strava activity and extract segment info
app.get('/utils/inspect-activity/:activityId', async (req, res) => {
  const activityId = req.params.activityId;
  
  try {
    // Get participant from session
    const stravaAthleteId = req.session?.stravaAthleteId;
    if (!stravaAthleteId) {
      return res.status(401).json({ 
        error: 'Not authenticated',
        message: 'You must connect your Strava account first'
      });
    }
    
    // Get valid access token
    let accessToken;
    try {
      accessToken = await getValidAccessToken(stravaAthleteId);
    } catch (error) {
      return res.status(401).json({ 
        error: 'Strava not connected',
        message: 'Please reconnect your Strava account',
        details: error.message
      });
    }
    
    // Fetch activity details
    const activity = await fetchStravaActivity(activityId, accessToken);
    
    // Helper to format seconds as MM:SS
    const formatTime = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    
    // Extract segment information
    const segments = (activity.segment_efforts || []).map(effort => ({
      segment_id: effort.segment.id,
      segment_name: effort.segment.name,
      segment_url: `https://www.strava.com/segments/${effort.segment.id}`,
      effort_time: effort.elapsed_time,
      effort_time_formatted: formatTime(effort.elapsed_time),
      pr_rank: effort.pr_rank || null,
      is_pr: !!effort.pr_rank
    }));
    
    // Return activity summary with segment details
    res.json({
      activity_id: activity.id,
      activity_name: activity.name,
      activity_url: `https://www.strava.com/activities/${activity.id}`,
      activity_date: activity.start_date_local.split('T')[0],
      activity_time: activity.start_date_local.split('T')[1],
      distance: activity.distance,
      total_segments: segments.length,
      segments: segments,
      usage_hint: 'Copy the segment_id from the segment you want to use for a week'
    });
    
  } catch (error) {
    console.error('Activity inspection error:', error);
    res.status(500).json({ 
      error: 'Failed to inspect activity',
      details: error.message
    });
  }
});

// GET /admin/segment/:id - Get detailed information about a specific Strava segment
app.get('/admin/segment/:id', async (req, res) => {
  const segmentId = req.params.id;
  
  try {
    // Get authenticated user's token
    const stravaAthleteId = req.session?.stravaAthleteId;
    if (!stravaAthleteId) {
      return res.status(401).json({ 
        error: 'Not authenticated',
        message: 'You must connect your Strava account first'
      });
    }

    const token = await getValidAccessToken(stravaAthleteId);
    if (!token) {
      return res.status(401).json({ 
        error: 'No valid token',
        message: 'Please reconnect your Strava account'
      });
    }

    console.log(`[GET /admin/segment/${segmentId}] Using token for athlete ${stravaAthleteId}`);
    console.log(`[GET /admin/segment/${segmentId}] Token starts with: ${token.substring(0, 20)}...`);

    const segmentDetails = await getSegmentDetails(segmentId, token);
    res.json(segmentDetails);
  } catch (error) {
    console.error('Error getting segment details:', error);
    res.status(500).json({ 
      error: 'Failed to get segment details',
      message: error.message
    });
  }
});

// GET /admin/activity/:id/segments - Get all segments from a specific activity
app.get('/admin/activity/:id/segments', async (req, res) => {
  const activityId = req.params.id;
  
  try {
    // Get authenticated user's token
    const stravaAthleteId = req.session?.stravaAthleteId;
    if (!stravaAthleteId) {
      return res.status(401).json({ 
        error: 'Not authenticated',
        message: 'You must connect your Strava account first'
      });
    }

    const token = await getValidAccessToken(stravaAthleteId);
    if (!token) {
      return res.status(401).json({ 
        error: 'No valid token',
        message: 'Please reconnect your Strava account'
      });
    }

    const segments = await getSegmentsFromActivity(activityId, token);
    res.json({
      activity_id: activityId,
      segment_count: segments.length,
      segments: segments
    });
  } catch (error) {
    console.error('Error getting activity segments:', error);
    res.status(500).json({ 
      error: 'Failed to get activity segments',
      message: error.message
    });
  }
});

// GET /admin/segments/starred - Get authenticated user's starred segments
app.get('/admin/segments/starred', async (req, res) => {
  try {
    // Get authenticated user's token
    const stravaAthleteId = req.session?.stravaAthleteId;
    if (!stravaAthleteId) {
      return res.status(401).json({ 
        error: 'Not authenticated',
        message: 'You must connect your Strava account first'
      });
    }

    const token = await getValidAccessToken(stravaAthleteId);
    if (!token) {
      return res.status(401).json({ 
        error: 'No valid token',
        message: 'Please reconnect your Strava account'
      });
    }

    console.log(`[GET /admin/segments/starred] Fetching starred segments`);

    const segments = await getStarredSegments(token);
    
    console.log(`[GET /admin/segments/starred] Found ${segments.length} starred segments`);
    
    res.json({
      count: segments.length,
      segments: segments
    });
  } catch (error) {
    console.error('Error fetching starred segments:', error);
    res.status(500).json({ 
      error: 'Failed to fetch starred segments',
      message: error.message
    });
  }
});
*/

// Export for testing
module.exports = { app, db, validateActivityTimeWindow, calculateWeekResults };

// Only start server if not being imported for tests
if (require.main === module) {
  // Seed season on startup if needed
  const existingSeasons = db.prepare('SELECT COUNT(*) as count FROM seasons').get();
  if (existingSeasons.count === 0) {
    console.log('🌱 No seasons found. Creating Fall 2025 season...');
    db.prepare(`
      INSERT INTO seasons (id, name, start_date, end_date, is_active)
      VALUES (?, ?, ?, ?, ?)
    `).run(1, 'Fall 2025', '2025-10-01', '2025-12-31', 1);
    console.log('✅ Fall 2025 season created (Oct 1 - Dec 31)');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WMV backend listening on port ${PORT}`);
  });
}
