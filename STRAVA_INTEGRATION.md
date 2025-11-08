# Participant Strava Integration

## Overview
This document explains how participants in the Western Mass Velo weekly competition will connect their Strava accounts and authorize the app to access their activities.

**Scale Note:** Western Mass Velo will have <100 participants. This is well within Strava's rate limits (100 requests per 15 minutes, 1000 per day) and doesn't require complex scaling architecture.

## Current Status
- ✅ Backend supports storing Strava athlete IDs
- ✅ Test data includes fake Strava IDs for development
- ✅ Strava API Application registered (Client ID: 170916)
- ⏳ OAuth integration pending (see roadmap below)

## How Multi-User OAuth Works

### The Big Picture
**Every participant must individually authorize your app.** Here's the flow:

1. **User visits your app** → Sees "Connect with Strava" button
2. **User clicks button** → Redirected to `strava.com/oauth/authorize`
3. **Strava prompts for permission** → User sees what data you're requesting
4. **User approves** → Strava redirects back to YOUR app with authorization code
5. **Your backend exchanges code** → Gets access token + refresh token for THIS user
6. **Tokens stored in database** → Associated with this participant's record

**Key Point:** Each participant has their own set of tokens. You're not accessing a "club account" - you're accessing individual athlete data with their explicit permission.

## OAuth Flow Design (Implementation Details)

### Step 1: User Initiates Connection

When a participant first uses the app, they see their status:
- **Not connected**: "Connect with Strava" button visible
- **Connected**: "Connected as [athlete name]" with option to disconnect

Frontend sends user to backend route:
```
GET /auth/strava
```

Backend redirects to Strava OAuth with your app credentials:
Backend redirects to Strava OAuth with your app credentials:
```javascript
app.get('/auth/strava', (req, res) => {
  const stravaAuthUrl = 'https://www.strava.com/oauth/authorize?' + 
    new URLSearchParams({
      client_id: process.env.STRAVA_CLIENT_ID,  // 170916
      redirect_uri: 'http://localhost:3001/auth/strava/callback',
      response_type: 'code',
      approval_prompt: 'auto',  // 'force' to always show consent screen
      scope: 'activity:read,profile:read_all'
    });
  
  res.redirect(stravaAuthUrl);
});
```

**Scopes Requested:**
- `activity:read` - Read the user's public and follower-visible activities
- `profile:read_all` - Read full athlete profile to link Strava athlete ID

### Step 2: User Authorizes on Strava

Strava shows authorization screen:
- Lists scopes your app is requesting
- User can uncheck specific permissions (your app should handle this)
- User clicks "Authorize"

### Step 3: Strava Redirects Back to Your App

Strava redirects to your callback URL with authorization code:
```
http://localhost:3001/auth/strava/callback?code=abc123def456&scope=read,activity:read,profile:read_all
```

**Important:** Check the `scope` parameter - user may have denied some permissions!
**Important:** Check the `scope` parameter - user may have denied some permissions!

### Step 4: Exchange Authorization Code for Tokens

```javascript
// Route: GET /auth/strava/callback?code=...&scope=...
app.get('/auth/strava/callback', async (req, res) => {
  const { code, scope } = req.query;
  
  if (!code) {
    return res.status(400).send('Authorization denied');
  }
  
  // Exchange code for tokens
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
  
  const tokenData = await tokenResponse.json();
  /*
  {
    "token_type": "Bearer",
    "expires_at": 1568775134,        // Unix timestamp when access_token expires
    "expires_in": 21600,             // Seconds until expiration (6 hours)
    "refresh_token": "e5n567567...", // Use this to get new access tokens
    "access_token": "a4b945687g...", // Use this to call Strava API
    "athlete": {
      "id": 227615,                  // Strava athlete ID - THIS IS KEY!
      "username": "marianne_t",
      "firstname": "Marianne",
      "lastname": "T",
      "city": "San Francisco",
      ...
    }
  }
  */
  
  const stravaAthleteId = tokenData.athlete.id;
  
  // Find or create participant in your database
  let participant = db.prepare(`
    SELECT * FROM participants WHERE strava_athlete_id = ?
  `).get(stravaAthleteId);
  
  if (!participant) {
    // New user - create participant record
    const result = db.prepare(`
      INSERT INTO participants (name, strava_athlete_id)
      VALUES (?, ?)
    `).run(
      `${tokenData.athlete.firstname} ${tokenData.athlete.lastname}`,
      stravaAthleteId
    );
    participant = { id: result.lastInsertRowid };
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
  
  // Store session/cookie so frontend knows who's logged in
  // (Session management implementation depends on your auth strategy)
  req.session.participantId = participant.id;
  req.session.athleteName = tokenData.athlete.firstname;
  
  // Redirect to dashboard
  res.redirect('/dashboard');
});
```

**Key Points:**
- **Authorization codes are single-use** - Can only exchange them once
- **Access tokens expire in 6 hours** - Must use refresh token to get new ones
- **Refresh tokens can change** - Always store the latest one returned
- **Each participant has unique tokens** - Stored per participant_id in database

### Step 5: Token Storage Schema
### Step 5: Token Storage Schema

Database table to store OAuth tokens for each participant:

```sql
CREATE TABLE IF NOT EXISTS participant_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_id INTEGER NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,  -- Unix timestamp (e.g., 1568775134)
  scope TEXT,                    -- Scopes user actually granted (may differ from requested)
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(participant_id) REFERENCES participants(id) ON DELETE CASCADE
);

CREATE INDEX idx_participant_tokens_participant ON participant_tokens(participant_id);
```

**Security Note:** In production, encrypt `access_token` and `refresh_token` at rest using `crypto` module or a secrets management service.

### Step 6: Refresh Tokens Before Making API Calls

**Critical:** Access tokens expire every 6 hours. Before making ANY Strava API call, check expiration and refresh if needed:

**Critical:** Access tokens expire every 6 hours. Before making ANY Strava API call, check expiration and refresh if needed:

```javascript
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
    
    const newTokenData = await refreshResponse.json();
    /*
    {
      "token_type": "Bearer",
      "access_token": "a9b723...",      // NEW access token
      "expires_at": 1568775134,         // NEW expiration time
      "expires_in": 20566,
      "refresh_token": "b5c569..."      // NEW refresh token (old one invalidated!)
    }
    */
    
    // Update database with NEW tokens
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
}
```

**Why refresh proactively (1 hour before expiration)?**
- Avoids race conditions where token expires mid-request
- Strava may return existing token if not yet expired, so no cost to refresh early

## Leveraging Strava Clubs

You mentioned all participants are in a Western Mass Velo Strava Club. Here's how that can help:

### Option A: Club Activities Endpoint (Read-Only)

If you know your club ID (visible in club URL: `strava.com/clubs/YOUR_CLUB_ID`), you can fetch recent club activities:

```javascript
// GET /clubs/{id}/activities
async function getClubActivities(clubId, accessToken) {
  const response = await fetch(
    `https://www.strava.com/api/v3/clubs/${clubId}/activities?per_page=100`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );
  
  const activities = await response.json();
  /*
  [
    {
      "athlete": { "firstname": "Marianne", "lastname": "T" },
      "name": "Tuesday Night Ride",
      "distance": 28099.0,
      "moving_time": 4207,
      "type": "Ride",
      "start_date": "2025-11-12T18:30:00Z"
    },
    ...
  ]
  */
  return activities;
}
```

**Limitations:**
- Only shows summary data (no segment efforts)
- Requires at least ONE participant to be authorized (to get an access token)
- Can't determine which specific segment was ridden
- Privacy settings may hide some activities

**Use Case:** Could be used for a "Recent Club Activity" feed on homepage, but NOT sufficient for leaderboard calculation.

### Option B: Per-Participant Authorization (Recommended)

For accurate leaderboard calculation with segment efforts, you MUST:
1. Have each participant authorize your app individually
2. Store their personal access/refresh tokens
3. Fetch their specific activities using their tokens
4. Extract segment effort data from those activities

**Why?** Segment effort data is only available when fetching a participant's own activities with their authorized token.

## Multi-User Authorization Workflow

### For Your Western Mass Velo Club:

**Initial Setup** (One-time per participant):
1. Admin announces new app to club members
2. Each cyclist visits your app URL
3. They click "Connect with Strava"
4. Strava prompts them to authorize YOUR app to read their activities
5. They approve → their tokens are stored in your database
6. Now you can access their activity data programmatically

**Weekly Competition Flow:**
1. Tuesday ride happens (everyone rides same segment × required laps)
2. Participants sync rides to Strava as normal (via Garmin, phone, etc.)
3. **Option A - Manual Submission**: 
   - Participant logs into your app
   - Pastes their Strava activity URL
   - Your backend fetches activity using their stored token
4. **Option B - Auto-Detection** (after OAuth is working):
   - Your cron job runs Tuesday night
   - For each authorized participant, fetch Tuesday's activities
   - Find activities containing the week's segment
   - Auto-populate leaderboard

### Common Questions:

**Q: Do participants need to do anything special on Strava?**
A: No! They just need to authorize your app once. After that, they ride and sync activities to Strava normally.

**Q: What if someone doesn't want to connect their Strava?**
A: Manual entry fallback - admin can enter their time manually (as you do now).

**Q: Can I revoke someone's access?**
A: Yes, delete their row from `participant_tokens` table. They can also revoke from Strava settings.

**Q: What if someone's token expires and refresh fails?**
A: They'll need to re-authorize (e.g., if they revoked access on Strava side). Show "Reconnect Strava" button.

## Activity Submission Workflow

### Option A: Self-Service Submission (Recommended for MVP)
Participants manually submit their Strava activity URL for each week:

1. After completing Tuesday's ride, participant goes to app
2. Finds current week's objective
3. Pastes their Strava activity URL: `https://www.strava.com/activities/16352338782`
4. Click "Submit Activity"
5. Backend:
   - Extracts activity ID from URL
   - Uses participant's stored token to fetch activity details
   - Validates date, segment, laps
   - Stores activity and segment efforts
   - Calculates leaderboard

**Pros:**
- Simple UX - one URL per week
- Clear what's being submitted
- Works for virtual and outdoor rides

**Cons:**
- Requires manual submission
- Participants might forget

### Option B: Auto-Detection (Future Enhancement)
Automatically detect activities on Tuesday that match segment:

1. Cron job runs every Tuesday evening
2. For each participant:
   - Get valid token
   - Fetch activities from Tuesday (using `after` and `before` timestamps)
   - Search for activities containing the week's segment
   - Auto-validate and submit
3. Send notification if successful or if action needed

**Pros:**
- Zero effort for participants
- Can't forget to submit

**Cons:**
- More complex
- Needs webhook or polling
- Risk of wrong activity being selected

### Option C: Hybrid
- Auto-detection runs as default
- Participants can manually override/submit different activity
- Admin can manually approve/reject

## Required Strava API Scopes

### For Activity Submission
```
activity:read          # Read activity details
activity:read_all      # Access private activities (if needed)
profile:read_all       # Read athlete profile
```

### Scope Request URL
```
https://www.strava.com/oauth/authorize?
  client_id=YOUR_CLIENT_ID&
  response_type=code&
  redirect_uri=https://yourapp.com/auth/strava/callback&
  approval_prompt=auto&
  scope=activity:read,profile:read_all
```

## Implementation Checklist

### Phase 1: OAuth Setup (Multi-User Authentication)
- [ ] **Environment variables**: Add `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REDIRECT_URI` to `.env`
- [ ] **Database migration**: Add `participant_tokens` table to schema (see SQL above)
- [ ] **Route: `/auth/strava`**: Redirect to Strava OAuth authorize URL
- [ ] **Route: `/auth/strava/callback`**: Exchange code for tokens
- [ ] **Token refresh utility**: `getValidAccessToken(participantId)` function
- [ ] **Session management**: Store `participantId` in session/cookies
- [ ] **Frontend**: "Connect with Strava" button + connection status display
- [ ] **Error handling**: Handle denied authorization, expired tokens, network errors

**Testing:** Use your own Strava account to connect/disconnect, verify tokens stored in database

### Phase 2: Activity Submission & Validation
- [ ] **Route: `POST /weeks/:id/submit-activity`**: Accept Strava activity URL
- [ ] **Activity ID extraction**: Parse `strava.com/activities/12345` → `12345`
- [ ] **Fetch from Strava**: `GET /activities/{id}` with participant's access token
- [ ] **Date validation**: Ensure `start_date_local` matches week's Tuesday
- [ ] **Segment effort extraction**: Find matching `strava_segment_id` in `segment_efforts[]`
- [ ] **Lap count verification**: Ensure participant completed required laps
- [ ] **Database storage**: Insert into `activities`, `segment_efforts`, and `results` tables
- [ ] **Leaderboard recalculation**: Update scores and rankings

**Testing:** Submit real Strava activity URLs from test rides, verify leaderboard updates correctly

### Phase 3: Frontend Integration
- [ ] **Login/auth flow**: Check session, show "Connect" or "Connected as {name}"
- [ ] **Weekly submission UI**: Input for Strava URL, submit button
- [ ] **Real-time validation feedback**: "Activity submitted successfully!" or error messages
- [ ] **Leaderboard links**: Make activity URLs clickable to view on Strava
- [ ] **Connection status page**: Show which participants are connected
- [ ] **Disconnect button**: Allow users to revoke access

**Testing:** Full end-to-end flow from connection to submission to leaderboard display

### Phase 4: Auto-Detection (Advanced)
- [ ] **Cron job**: Run Tuesday evenings at 10 PM (after rides typically finish)
- [ ] **For each participant**: Fetch activities from `after=tuesday_start&before=tuesday_end`
- [ ] **Segment matching**: Find activities containing week's segment in `segment_efforts`
- [ ] **Auto-validation**: Same validation as manual submission
- [ ] **Notification**: Email/alert participants if submission successful or needs review
- [ ] **Manual override**: Allow participants to change which activity counts

**Testing:** Manually trigger cron job logic, verify correct activities detected

### Phase 5: Admin Tools (Optional Enhancements)
- [ ] **Participant management page**: View connection status, last token refresh
- [ ] **Force reconnection**: Admin can mark token as expired to prompt re-auth
- [ ] **Activity review**: View all submissions, approve/reject manually
- [ ] **Bulk operations**: Re-validate all activities for a week
- [ ] **Audit log**: Track who submitted what, when



## Testing Without Real OAuth

### Current Approach (In Use)
We've seeded test data with:
- Fake `strava_athlete_id` values (1234567, 2345678, etc.)
- Fake `strava_activity_id` values
- Fake activity URLs pointing to non-existent Strava activities
- Realistic segment effort data

This allows full development and testing of:
- Leaderboard calculation
- Scoring logic
- Multi-lap support
- Season totals
- All API endpoints

### Mock API Mode (Future Option)
For integration testing before OAuth is ready:

```javascript
const MOCK_MODE = process.env.STRAVA_MOCK === 'true';

async function fetchStravaActivity(activityId, accessToken) {
  if (MOCK_MODE) {
    // Return fake activity data
    return {
      id: activityId,
      start_date: '2025-11-12T08:32:00Z',
      segment_efforts: [
        { segment: { id: 23456789 }, elapsed_time: 885 },
        { segment: { id: 23456789 }, elapsed_time: 895 }
      ]
    };
  }
  
  // Real Strava API call
  const strava = new Strava({ access_token: accessToken });
  return await strava.activities.get({ id: activityId });
}
```

## Security Considerations

### Token Storage
- **Development:** SQLite with plaintext tokens (OK for local testing)
- **Production:** Encrypt tokens using `crypto` module or library like `node-vault`

### API Rate Limits
Strava limits:
- **100 requests per 15 minutes** (per application)
- **1000 requests per day** (per application)

**For your use case:**
- 10 participants × 2 API calls per weekly submission = 20 calls/week
- Auto-detection: 10 participants × 2 calls (list + fetch) = 20 calls on Tuesday night
- Token refresh overhead: ~10 refreshes/day max
- **Total: ~200 requests/week** → Well within limits! ✅

**If you hit limits:**
- Strava returns HTTP 429 with `X-RateLimit-*` headers
- Implement exponential backoff retry logic
- Cache activity data to avoid re-fetching

### Privacy & Data Handling
- **Minimum scopes**: Only request `activity:read` and `profile:read_all` (don't request write access unless needed)
- **Participant consent**: Display exactly what data you're accessing in OAuth prompt
- **Revocation**: Provide "Disconnect Strava" button on participant dashboard
- **Data retention**: Consider auto-deleting tokens for inactive participants (no submission in 6 months)
- **Public vs private activities**: Respect activity visibility - if athlete set activity to "Only Me", your app can't see it without `activity:read_all` scope
- **Aggregated results only**: Show leaderboard with names and times, but don't expose full activity routes/maps

### Token Security Best Practices
- **Development**: Plaintext tokens in SQLite OK for local testing
- **Production**: 
  - Encrypt tokens at rest (use `crypto.createCipher` or AWS Secrets Manager)
  - Use HTTPS for all OAuth redirects
  - Set `secure` and `httpOnly` flags on session cookies
  - Rotate `client_secret` periodically via Strava settings
## Rate Limits & Best Practices

**With <100 participants:**
- Strava allows 100 requests per 15 minutes, 1000 requests per day
- You'll use ~100 requests/week to fetch participant activities (one per participant)
- Rate limits are not a concern at this scale - simple implementation is fine
- No need for queues, batching, or complex rate limit handling
- Cache athlete data to avoid unnecessary repeat calls
- Sequential API calls work perfectly fine

**Security:**
- Store tokens encrypted in production (or use environment encryption)
- Never log tokens: Redact from error logs and console output

## Next Steps to Get Started

### 1. Verify Strava App Registration ✅ (Already Done!)
Your app is registered with Client ID `170916`. Check these settings on [Strava API Settings](https://www.strava.com/settings/api):
- **Authorization Callback Domain**: Should include `localhost` (for dev) and your production domain
- **Application Name**: What participants will see when authorizing
- **Icon**: Upload club logo for branding

### 2. Set Environment Variables
Create/update `server/.env`:
```bash
STRAVA_CLIENT_ID=170916
STRAVA_CLIENT_SECRET=8b6e881a410ba3f4313c85b88796d982f38a59a9
STRAVA_REDIRECT_URI=http://localhost:3001/auth/strava/callback
```

**Production:** Update `STRAVA_REDIRECT_URI` to `https://yourdomain.com/auth/strava/callback`

### 3. Database Migration (Already Done! ✅)
The `participant_tokens` table has already been added to the schema in `server/src/index.js`. When you restart the server, it will automatically create this table if it doesn't exist yet.

**To verify the table exists:**
```bash
sqlite3 server/data/wmv.db "SELECT name FROM sqlite_master WHERE type='table' AND name='participant_tokens';"
```

**The table structure:**
```sql
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
```

### 4. Implement OAuth Routes (Start Here!)
Follow Phase 1 implementation checklist above:
- `GET /auth/strava` - Redirect to Strava
- `GET /auth/strava/callback` - Handle authorization response
- `async function getValidAccessToken(participantId)` - Token refresh utility

### 5. Test with Your Own Account
1. Start dev server: `npm run dev:all`
2. Visit `http://localhost:5173` 
3. Click "Connect with Strava"
4. Authorize with your personal Strava account
5. Verify token stored in `participant_tokens` table
6. Try submitting a real activity from your Strava

### 6. Roll Out to Club Members
Once tested:
1. Update PLAN.md to mark OAuth as complete
2. Announce to Western Mass Velo members
3. Provide simple instructions: "Visit app → Click Connect → Done!"
4. Monitor for connection issues/questions


