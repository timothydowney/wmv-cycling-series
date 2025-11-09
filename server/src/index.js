const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const Database = require('better-sqlite3');
const session = require('express-session');

dotenv.config();

const PORT = process.env.PORT || 3001;
const CLIENT_BASE_URL = process.env.CLIENT_BASE_URL || 'http://localhost:5173';
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'wmv.db');

const app = express();
// Enable CORS for local development - allow both localhost and 127.0.0.1
app.use(cors({ 
  origin: [CLIENT_BASE_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));
app.use(express.json());

// Session configuration for OAuth
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));

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
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  strava_athlete_id INTEGER UNIQUE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS segments (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  strava_segment_id INTEGER NOT NULL UNIQUE,
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
  FOREIGN KEY(segment_id) REFERENCES segments(id)
);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_id INTEGER NOT NULL,
  participant_id INTEGER NOT NULL,
  strava_activity_id INTEGER NOT NULL,
  activity_url TEXT NOT NULL,
  activity_date TEXT NOT NULL,
  validation_status TEXT DEFAULT 'valid',
  validation_message TEXT,
  validated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(week_id) REFERENCES weeks(id),
  FOREIGN KEY(participant_id) REFERENCES participants(id),
  UNIQUE(week_id, participant_id)
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
  FOREIGN KEY(segment_id) REFERENCES segments(id)
);

CREATE TABLE IF NOT EXISTS results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_id INTEGER NOT NULL,
  participant_id INTEGER NOT NULL,
  activity_id INTEGER,
  total_time_seconds INTEGER NOT NULL,
  rank INTEGER,
  points INTEGER,
  pr_bonus_points INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(week_id) REFERENCES weeks(id),
  FOREIGN KEY(participant_id) REFERENCES participants(id),
  FOREIGN KEY(activity_id) REFERENCES activities(id),
  UNIQUE(week_id, participant_id)
);

CREATE TABLE IF NOT EXISTS participant_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_id INTEGER NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  scope TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(participant_id) REFERENCES participants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_activities_week_participant ON activities(week_id, participant_id);
CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(validation_status);
CREATE INDEX IF NOT EXISTS idx_segment_efforts_activity ON segment_efforts(activity_id);
CREATE INDEX IF NOT EXISTS idx_results_week ON results(week_id);
CREATE INDEX IF NOT EXISTS idx_results_participant ON results(participant_id);
CREATE INDEX IF NOT EXISTS idx_participant_tokens_participant ON participant_tokens(participant_id);
CREATE INDEX IF NOT EXISTS idx_weeks_season ON weeks(season_id);
CREATE INDEX IF NOT EXISTS idx_seasons_active ON seasons(is_active);
`);

// Seed test data
function seedTestData() {
  const participantCount = db.prepare('SELECT COUNT(*) as c FROM participants').get().c;
  if (participantCount > 0) {
    console.log('Database already seeded, skipping...');
    return;
  }

  console.log('Seeding test data...');

  db.transaction(() => {
    // Season - Fall 2025
    db.prepare('INSERT INTO seasons (id, name, start_date, end_date, is_active) VALUES (?, ?, ?, ?, ?)').run(
      1, 
      'Fall 2025', 
      '2025-11-01', 
      '2025-12-31', 
      1
    );

    // Participants with fake Strava athlete IDs
    const participants = [
      { id: 1, name: 'Jonny', strava_athlete_id: 1234567 },
      { id: 2, name: 'Chris', strava_athlete_id: 2345678 },
      { id: 3, name: 'Matt', strava_athlete_id: 3456789 },
      { id: 4, name: 'Tim', strava_athlete_id: 4567890 }
    ];
    const insertParticipant = db.prepare('INSERT INTO participants (id, name, strava_athlete_id) VALUES (?, ?, ?)');
    participants.forEach(p => insertParticipant.run(p.id, p.name, p.strava_athlete_id));

    // Segments
    const segments = [
      { id: 1, name: 'Lookout Mountain Climb', strava_segment_id: 12345678 },
      { id: 2, name: 'Champs-Élysées', strava_segment_id: 23456789 }
    ];
    const insertSegment = db.prepare('INSERT INTO segments (id, name, strava_segment_id) VALUES (?, ?, ?)');
    segments.forEach(s => insertSegment.run(s.id, s.name, s.strava_segment_id));

    // Weeks with time windows (midnight to 10pm on event day)
    const weeks = [
      { 
        season_id: 1,
        week_name: 'Week 1: Lookout Mountain', 
        date: '2025-11-05', 
        segment_id: 1, 
        required_laps: 1,
        start_time: '2025-11-05T00:00:00Z',
        end_time: '2025-11-05T22:00:00Z'
      },
      { 
        season_id: 1,
        week_name: 'Week 2: Champs-Élysées Double', 
        date: '2025-11-12', 
        segment_id: 2, 
        required_laps: 2,
        start_time: '2025-11-12T00:00:00Z',
        end_time: '2025-11-12T22:00:00Z'
      }
    ];
    const insertWeek = db.prepare('INSERT INTO weeks (season_id, week_name, date, segment_id, required_laps, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?)');
    weeks.forEach(w => insertWeek.run(w.season_id, w.week_name, w.date, w.segment_id, w.required_laps, w.start_time, w.end_time));

    // Week 1 Activities (3 participants completed)
    const week1Activities = [
      { 
        week_id: 1, 
        participant_id: 1, 
        strava_activity_id: 16301234567,
        activity_url: 'https://www.strava.com/activities/16301234567',
        activity_date: '2025-11-05',
        validation_message: 'Activity validated successfully'
      },
      { 
        week_id: 1, 
        participant_id: 2, 
        strava_activity_id: 16301234568,
        activity_url: 'https://www.strava.com/activities/16301234568',
        activity_date: '2025-11-05',
        validation_message: 'Activity validated successfully'
      },
      { 
        week_id: 1, 
        participant_id: 3, 
        strava_activity_id: 16301234569,
        activity_url: 'https://www.strava.com/activities/16301234569',
        activity_date: '2025-11-05',
        validation_message: 'Activity validated successfully'
      }
    ];

    const insertActivity = db.prepare(`
      INSERT INTO activities (week_id, participant_id, strava_activity_id, activity_url, activity_date, validation_status, validation_message)
      VALUES (?, ?, ?, ?, ?, 'valid', ?)
    `);
    week1Activities.forEach(a => {
      insertActivity.run(a.week_id, a.participant_id, a.strava_activity_id, a.activity_url, a.activity_date, a.validation_message);
    });

    // Week 1 Segment Efforts (1 lap each)
    const week1Efforts = [
      { activity_id: 1, segment_id: 1, effort_index: 1, elapsed_seconds: 1510, start_time: '2025-11-05T08:15:00Z', pr_achieved: 0 }, // Jonny
      { activity_id: 2, segment_id: 1, effort_index: 1, elapsed_seconds: 1605, start_time: '2025-11-05T08:20:00Z', pr_achieved: 0 }, // Chris
      { activity_id: 3, segment_id: 1, effort_index: 1, elapsed_seconds: 1485, start_time: '2025-11-05T08:10:00Z', pr_achieved: 1 }  // Matt (fastest + PR!)
    ];

    const insertEffort = db.prepare(`
      INSERT INTO segment_efforts (activity_id, segment_id, effort_index, elapsed_seconds, start_time, pr_achieved)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    week1Efforts.forEach(e => {
      insertEffort.run(e.activity_id, e.segment_id, e.effort_index, e.elapsed_seconds, e.start_time, e.pr_achieved);
    });

    // Week 2 Activities (all 4 participants, 2 laps each)
    const week2Activities = [
      { 
        week_id: 2, 
        participant_id: 1, 
        strava_activity_id: 16352338780,
        activity_url: 'https://www.strava.com/activities/16352338780',
        activity_date: '2025-11-12',
        validation_message: 'Activity validated successfully - 2 laps completed'
      },
      { 
        week_id: 2, 
        participant_id: 2, 
        strava_activity_id: 16352338781,
        activity_url: 'https://www.strava.com/activities/16352338781',
        activity_date: '2025-11-12',
        validation_message: 'Activity validated successfully - 2 laps completed'
      },
      { 
        week_id: 2, 
        participant_id: 3, 
        strava_activity_id: 16352338782,
        activity_url: 'https://www.strava.com/activities/16352338782',
        activity_date: '2025-11-12',
        validation_message: 'Activity validated successfully - 2 laps completed'
      },
      { 
        week_id: 2, 
        participant_id: 4, 
        strava_activity_id: 16352338783,
        activity_url: 'https://www.strava.com/activities/16352338783',
        activity_date: '2025-11-12',
        validation_message: 'Activity validated successfully - 2 laps completed'
      }
    ];

    week2Activities.forEach(a => {
      insertActivity.run(a.week_id, a.participant_id, a.strava_activity_id, a.activity_url, a.activity_date, a.validation_message);
    });

    // Week 2 Segment Efforts (2 laps each - Champs-Élysées segment)
    const week2Efforts = [
      // Jonny - 2 laps, got a PR on lap 2!
      { activity_id: 4, segment_id: 2, effort_index: 1, elapsed_seconds: 885, start_time: '2025-11-12T08:32:00Z', pr_achieved: 0 },
      { activity_id: 4, segment_id: 2, effort_index: 2, elapsed_seconds: 895, start_time: '2025-11-12T08:47:00Z', pr_achieved: 1 },
      // Chris - 2 laps
      { activity_id: 5, segment_id: 2, effort_index: 1, elapsed_seconds: 920, start_time: '2025-11-12T08:35:00Z', pr_achieved: 0 },
      { activity_id: 5, segment_id: 2, effort_index: 2, elapsed_seconds: 910, start_time: '2025-11-12T08:50:00Z', pr_achieved: 0 },
      // Matt - 2 laps (fastest total, both laps are PRs!)
      { activity_id: 6, segment_id: 2, effort_index: 1, elapsed_seconds: 870, start_time: '2025-11-12T08:30:00Z', pr_achieved: 1 },
      { activity_id: 6, segment_id: 2, effort_index: 2, elapsed_seconds: 875, start_time: '2025-11-12T08:45:00Z', pr_achieved: 1 },
      // Tim - 2 laps
      { activity_id: 7, segment_id: 2, effort_index: 1, elapsed_seconds: 905, start_time: '2025-11-12T08:33:00Z', pr_achieved: 0 },
      { activity_id: 7, segment_id: 2, effort_index: 2, elapsed_seconds: 900, start_time: '2025-11-12T08:48:00Z', pr_achieved: 0 }
    ];

    week2Efforts.forEach(e => {
      insertEffort.run(e.activity_id, e.segment_id, e.effort_index, e.elapsed_seconds, e.start_time, e.pr_achieved);
    });

    console.log('Test data seeded successfully');
  })();

  // Calculate results for both weeks
  calculateWeekResults(1);
  calculateWeekResults(2);
}

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
      a.participant_id,
      SUM(se.elapsed_seconds) as total_time_seconds,
      MAX(se.pr_achieved) as achieved_pr
    FROM activities a
    JOIN segment_efforts se ON a.id = se.activity_id
    WHERE a.week_id = ? AND a.validation_status = 'valid'
    GROUP BY a.id, a.participant_id
    ORDER BY total_time_seconds ASC
  `).all(weekId);

  if (activities.length === 0) return;

  const totalParticipants = activities.length;
  
  // Delete existing results for this week
  db.prepare('DELETE FROM results WHERE week_id = ?').run(weekId);

  // Insert new results with correct scoring: points = (number of people you beat + 1 for competing) + PR bonus
  const insertResult = db.prepare(`
    INSERT INTO results (week_id, participant_id, activity_id, total_time_seconds, rank, points, pr_bonus_points)
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
        activity.participant_id,
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

// Seed on startup
seedTestData();

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Get a valid access token for a participant, refreshing if needed
 * @param {number} participantId - The participant's database ID
 * @returns {Promise<string>} Valid access token
 */
async function getValidAccessToken(participantId) {
  const tokenRecord = db.prepare(`
    SELECT * FROM participant_tokens WHERE participant_id = ?
  `).get(participantId);
  
  if (!tokenRecord) {
    throw new Error('Participant not connected to Strava');
  }
  
  const now = Math.floor(Date.now() / 1000);  // Current Unix timestamp
  
  // Token expires in less than 1 hour? Refresh it proactively
  if (tokenRecord.expires_at < (now + 3600)) {
    console.log(`Token expiring soon for participant ${participantId}, refreshing...`);
    
    // Request new access token using refresh token
    const refreshResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: tokenRecord.refresh_token
      })
    });
    
    if (!refreshResponse.ok) {
      const error = await refreshResponse.text();
      throw new Error(`Failed to refresh token: ${error}`);
    }
    
    const newTokenData = await refreshResponse.json();
    
    // Update database with NEW tokens (both access and refresh tokens change!)
    db.prepare(`
      UPDATE participant_tokens 
      SET access_token = ?,
          refresh_token = ?,
          expires_at = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE participant_id = ?
    `).run(
      newTokenData.access_token,
      newTokenData.refresh_token,
      newTokenData.expires_at,
      participantId
    );
    
    return newTokenData.access_token;
  }
  
  // Token still valid, return it
  return tokenRecord.access_token;
}

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
    // Exchange authorization code for tokens
    console.log('Exchanging OAuth code for tokens...');
    const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code'
      })
    });
    
    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Failed to exchange code for tokens:', error);
      return res.redirect(`${CLIENT_BASE_URL}?error=token_exchange_failed`);
    }
    
    const tokenData = await tokenResponse.json();
    const stravaAthleteId = tokenData.athlete.id;
    const athleteName = `${tokenData.athlete.firstname} ${tokenData.athlete.lastname}`;
    
    console.log(`OAuth successful for Strava athlete ${stravaAthleteId} (${athleteName})`);
    
    // Find or create participant in database
    let participant = db.prepare(`
      SELECT * FROM participants WHERE strava_athlete_id = ?
    `).get(stravaAthleteId);
    
    if (!participant) {
      console.log(`Creating new participant: ${athleteName}`);
      const result = db.prepare(`
        INSERT INTO participants (name, strava_athlete_id)
        VALUES (?, ?)
      `).run(athleteName, stravaAthleteId);
      
      participant = { id: result.lastInsertRowid, name: athleteName };
    }
    
    // Store tokens for this participant
    db.prepare(`
      INSERT OR REPLACE INTO participant_tokens 
      (participant_id, access_token, refresh_token, expires_at, scope)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      participant.id,
      tokenData.access_token,
      tokenData.refresh_token,
      tokenData.expires_at,
      scope || tokenData.scope
    );
    
    console.log(`Tokens stored for participant ${participant.id}`);
    
    // Store session
    req.session.participantId = participant.id;
    req.session.athleteName = tokenData.athlete.firstname;
    req.session.stravaAthleteId = stravaAthleteId;
    
    // Redirect to dashboard
    res.redirect(`${CLIENT_BASE_URL}?connected=true`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`${CLIENT_BASE_URL}?error=server_error`);
  }
});

// GET /auth/status - Check authentication status
app.get('/auth/status', (req, res) => {
  if (req.session.participantId) {
    const participant = db.prepare(`
      SELECT p.id, p.name, p.strava_athlete_id,
             CASE WHEN pt.participant_id IS NOT NULL THEN 1 ELSE 0 END as is_connected
      FROM participants p
      LEFT JOIN participant_tokens pt ON p.id = pt.participant_id
      WHERE p.id = ?
    `).get(req.session.participantId);
    
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
  if (!req.session.participantId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const participantId = req.session.participantId;
  
  // Delete tokens from database
  db.prepare('DELETE FROM participant_tokens WHERE participant_id = ?').run(participantId);
  
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
  const rows = db.prepare('SELECT id, name, strava_segment_id FROM segments').all();
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
      p.id,
      p.name,
      COALESCE(SUM(CASE WHEN w.season_id = ? THEN r.points ELSE 0 END), 0) as total_points,
      COUNT(CASE WHEN w.season_id = ? THEN r.id ELSE NULL END) as weeks_completed
    FROM participants p
    LEFT JOIN results r ON p.id = r.participant_id
    LEFT JOIN weeks w ON r.week_id = w.id
    GROUP BY p.id, p.name
    HAVING weeks_completed > 0
    ORDER BY total_points DESC, weeks_completed DESC
  `).all(seasonId, seasonId);

  res.json({ season, leaderboard: seasonResults });
});

// ========================================
// WEEKS ENDPOINTS
// ========================================

app.get('/weeks', (req, res) => {
  const rows = db.prepare('SELECT id, season_id, week_name, date, segment_id, required_laps, start_time, end_time FROM weeks ORDER BY date DESC').all();
  res.json(rows);
});

app.get('/weeks/:id', (req, res) => {
  const weekId = parseInt(req.params.id, 10);
  const week = db.prepare('SELECT id, season_id, week_name, date, segment_id, required_laps, start_time, end_time FROM weeks WHERE id = ?').get(weekId);
  if (!week) return res.status(404).json({ error: 'Week not found' });
  res.json(week);
});

app.get('/weeks/:id/leaderboard', (req, res) => {
  const weekId = parseInt(req.params.id, 10);
  const week = db.prepare('SELECT id, season_id, week_name, date, segment_id, required_laps, start_time, end_time FROM weeks WHERE id = ?').get(weekId);
  if (!week) return res.status(404).json({ error: 'Week not found' });

  const results = db.prepare(`
    SELECT 
      r.rank,
      r.participant_id,
      p.name,
      r.total_time_seconds,
      r.points,
      r.pr_bonus_points,
      a.activity_url,
      a.activity_date
    FROM results r
    JOIN participants p ON r.participant_id = p.id
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
      a.participant_id,
      p.name as participant_name,
      a.strava_activity_id,
      a.activity_url,
      a.activity_date,
      a.validation_status,
      a.validation_message
    FROM activities a
    JOIN participants p ON a.participant_id = p.id
    WHERE a.week_id = ?
    ORDER BY a.participant_id
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
    JOIN segments s ON se.segment_id = s.id
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
        p.id,
        p.name,
        COALESCE(SUM(CASE WHEN w.season_id = ? THEN r.points ELSE 0 END), 0) as total_points,
        COUNT(CASE WHEN w.season_id = ? THEN r.id ELSE NULL END) as weeks_completed
      FROM participants p
      LEFT JOIN results r ON p.id = r.participant_id
      LEFT JOIN weeks w ON r.week_id = w.id
      GROUP BY p.id, p.name
      HAVING weeks_completed > 0
      ORDER BY total_points DESC, weeks_completed DESC
    `).all(activeSeason.id, activeSeason.id);
    
    res.json(seasonResults);
  } else {
    // No active season - return all-time results
    const seasonResults = db.prepare(`
      SELECT 
        p.id,
        p.name,
        COALESCE(SUM(r.points), 0) as total_points,
        COUNT(r.id) as weeks_completed
      FROM participants p
      LEFT JOIN results r ON p.id = r.participant_id
      GROUP BY p.id, p.name
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
  const { season_id, week_name, date, segment_id, required_laps, start_time, end_time } = req.body;

  // Validate required fields
  if (!season_id || !week_name || !date || !segment_id || !required_laps) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      required: ['season_id', 'week_name', 'date', 'segment_id', 'required_laps']
    });
  }

  // Validate season exists
  const season = db.prepare('SELECT id FROM seasons WHERE id = ?').get(season_id);
  if (!season) {
    return res.status(400).json({ error: 'Invalid season_id' });
  }

  // Default time window: midnight to 10pm on event date
  const defaultStartTime = start_time || `${date}T00:00:00Z`;
  const defaultEndTime = end_time || `${date}T22:00:00Z`;

  // Validate segment exists
  const segment = db.prepare('SELECT id FROM segments WHERE id = ?').get(segment_id);
  if (!segment) {
    return res.status(400).json({ error: 'Invalid segment_id' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO weeks (season_id, week_name, date, segment_id, required_laps, start_time, end_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(season_id, week_name, date, segment_id, required_laps, defaultStartTime, defaultEndTime);

    const newWeek = db.prepare(`
      SELECT id, season_id, week_name, date, segment_id, required_laps, start_time, end_time
      FROM weeks WHERE id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(newWeek);
  } catch (error) {
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
    // Validate segment exists
    const segment = db.prepare('SELECT id FROM segments WHERE id = ?').get(segment_id);
    if (!segment) {
      return res.status(400).json({ error: 'Invalid segment_id' });
    }
    updates.push('segment_id = ?');
    values.push(segment_id);
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

// Future endpoint for activity submission
app.post('/weeks/:id/submit-activity', (req, res) => {
  const weekId = parseInt(req.params.id, 10);
  const { participant_id, strava_activity_id, activity_url, activity_date } = req.body;

  // Validate required fields
  if (!participant_id || !strava_activity_id || !activity_url || !activity_date) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      required: ['participant_id', 'strava_activity_id', 'activity_url', 'activity_date']
    });
  }

  // Get week details
  const week = db.prepare(`
    SELECT id, week_name, date, segment_id, required_laps, start_time, end_time 
    FROM weeks WHERE id = ?
  `).get(weekId);

  if (!week) {
    return res.status(404).json({ error: 'Week not found' });
  }

  // Validate time window
  const timeValidation = validateActivityTimeWindow(activity_date, week);
  if (!timeValidation.valid) {
    return res.status(400).json({ 
      error: 'Activity outside time window',
      details: timeValidation.message
    });
  }

  // TODO: Implement full Strava API integration:
  // 1. Fetch activity details from Strava API
  // 2. Extract segment efforts for the required segment
  // 3. Validate required_laps count
  // 4. Store activity and segment_efforts
  // 5. Recalculate week results

  res.status(501).json({ 
    error: 'Not fully implemented yet',
    message: 'Time window validation passed, but Strava API integration needed',
    validation: timeValidation,
    week: week
  });
});

// Export for testing
module.exports = { app, db, validateActivityTimeWindow, calculateWeekResults };

// Only start server if not being imported for tests
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`WMV backend listening on port ${PORT}`);
  });
}
