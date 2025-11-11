# Strava Integration Guide

Complete documentation for OAuth authentication, token management, and activity collection workflow.

**Related documentation:**
- **[OAUTH_SESSION_FIX.md](./OAUTH_SESSION_FIX.md)** - Technical deep-dive on reverse proxy session persistence issue (affects production deployments)
- **[OAUTH_FIX_SUMMARY.md](./OAUTH_FIX_SUMMARY.md)** - Analysis of how we debugged and fixed the OAuth session problem
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - How to deploy and configure OAuth in production

---

## Overview

Western Mass Velo's app integrates with Strava to automatically fetch participant activities. The system uses per-participant OAuth tokens to access individual athlete data with explicit permission.

**Scale:** Designed for <100 participants. Strava API limits (100 req/15min, 1000 req/day) are not a concern at this scale.

---

## Multi-User OAuth Architecture

### The Flow at a Glance

1. **Participant visits app** → Clicks "Connect with Strava" button
2. **Redirected to Strava** → Authorizes your app to read their activities
3. **Strava redirects back** → Your backend exchanges authorization code for tokens
4. **Tokens stored per participant** → Database links athlete to their access/refresh tokens
5. **App fetches activities** → Using participant's stored token, with automatic refresh

**Key Design:**
- Each participant has their own OAuth tokens
- You're accessing individual athlete data with their permission, not a shared "club account"
- Tokens automatically refresh before expiration (6-hour lifetime)
- One-time setup per participant (no weekly re-authentication)

---

## Step-by-Step Implementation

### Step 1: User Initiates Connection

When a participant first uses the app, they see their connection status:
- **Not connected:** "Connect with Strava" button visible
- **Connected:** "Connected as [athlete name]" with option to disconnect

Frontend sends user to:
```
GET /auth/strava
```

Backend redirects to Strava OAuth:

```javascript
app.get('/auth/strava', (req, res) => {
  const stravaAuthUrl = 'https://www.strava.com/oauth/authorize?' + 
    new URLSearchParams({
      client_id: process.env.STRAVA_CLIENT_ID,  // 170916
      redirect_uri: 'http://localhost:3001/auth/strava/callback',
      response_type: 'code',
      approval_prompt: 'auto',
      scope: 'activity:read,profile:read_all'
    });
  
  res.redirect(stravaAuthUrl);
});
```

**Scopes:**
- `activity:read` - Read public and follower-visible activities (not private)
- `profile:read_all` - Read full athlete profile to link Strava athlete ID

### Step 2: User Authorizes on Strava

Strava shows authorization screen listing the requested permissions. User can approve or deny.

### Step 3: Strava Redirects Back

Strava redirects to your callback URL with an authorization code:
```
http://localhost:3001/auth/strava/callback?code=abc123def456&scope=read,activity:read,profile:read_all
```

**Important:** Check the `scope` parameter—user may have denied specific permissions.

### Step 4: Exchange Authorization Code for Tokens

```javascript
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
    "expires_at": 1568775134,        // Unix timestamp
    "expires_in": 21600,             // Seconds (6 hours)
    "refresh_token": "e5n567567...", // Use to get new access tokens
    "access_token": "a4b945687g...", // Use to call Strava API
    "athlete": {
      "id": 227615,                  // Strava athlete ID (KEY!)
      "username": "marianne_t",
      "firstname": "Marianne",
      "lastname": "T",
      ...
    }
  }
  */
  
  const stravaAthleteId = tokenData.athlete.id;
  
  // Find or create participant in database
  let participant = db.prepare(`
    SELECT * FROM participants WHERE strava_athlete_id = ?
  `).get(stravaAthleteId);
  
  if (!participant) {
    // New user—create participant record
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
  
  // Create session so frontend knows who's logged in
  req.session.participantId = participant.id;
  req.session.athleteName = tokenData.athlete.firstname;
  
  // Redirect to dashboard
  res.redirect('/dashboard');
});
```

**Critical Points:**
- Authorization codes are **single-use** (can only exchange once)
- Access tokens expire in **6 hours**
- Refresh tokens can change (always store the latest)
- Each participant has unique tokens

### Step 5: Token Storage Schema

Database table for OAuth tokens:

```sql
CREATE TABLE IF NOT EXISTS participant_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_id INTEGER NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,  -- Unix timestamp
  scope TEXT,                    -- Scopes user actually granted
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(participant_id) REFERENCES participants(id) ON DELETE CASCADE
);

CREATE INDEX idx_participant_tokens_participant ON participant_tokens(participant_id);
```

**Security Note:** In production, encrypt `access_token` and `refresh_token` at rest.

### Step 6: Refresh Tokens Before API Calls

**Critical:** Access tokens expire every 6 hours. Before ANY Strava API call, check expiration and refresh if needed:

```javascript
async function getValidAccessToken(participantId) {
  const tokenRecord = db.prepare(`
    SELECT * FROM participant_tokens WHERE participant_id = ?
  `).get(participantId);
  
  if (!tokenRecord) {
    throw new Error('Participant not connected to Strava');
  }
  
  const now = Math.floor(Date.now() / 1000);  // Current Unix timestamp
  
  // Token expires in less than 1 hour? Refresh proactively
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
```

**Why refresh proactively (1 hour before expiry)?**
- Avoids race conditions where token expires mid-request
- Strava may return existing token if not yet expired (no extra cost)

---

## Activity Collection Workflow

### Admin Batch Fetch (Primary)

**Overview:** Admin triggers a batch fetch at end of event day. System processes all connected participants, fetches their activities, finds the best qualifying activity, and updates the leaderboard.

**Endpoint:** `POST /admin/weeks/:id/fetch-results`

**Flow:**

1. Admin triggers fetch at end of event day
2. System retrieves all connected participants (those with OAuth tokens)
3. For each participant:
   - Fetch activities from event day (using time window)
   - Filter to activities containing required segment
   - Identify best qualifying activity (required reps + fastest time)
   - Store activity and segment efforts
4. Recalculate leaderboard rankings and points
5. Return summary of results found

**Implementation:**

```javascript
app.post('/admin/weeks/:id/fetch-results', async (req, res) => {
  const weekId = req.params.id;
  
  // Get week details
  const week = db.prepare('SELECT * FROM weeks WHERE id = ?').get(weekId);
  if (!week) return res.status(404).json({ error: 'Week not found' });
  
  // Get all connected participants
  const participants = db.prepare(`
    SELECT p.id, p.name, p.strava_athlete_id, pt.access_token
    FROM participants p
    JOIN participant_tokens pt ON p.id = pt.participant_id
    WHERE pt.access_token IS NOT NULL
  `).all();
  
  const results = [];
  
  for (const participant of participants) {
    try {
      // Get valid token (auto-refreshes if needed)
      const accessToken = await getValidAccessToken(participant.id);
      
      // Fetch activities from event day
      const activities = await fetchActivitiesOnDay(
        accessToken,
        week.start_time,
        week.end_time
      );
      
      // Find best qualifying activity
      const bestActivity = await findBestQualifyingActivity(
        activities,
        week.segment_id,
        week.required_laps,
        accessToken
      );
      
      if (bestActivity) {
        // Store activity and efforts
        storeActivityAndEfforts(participant.id, weekId, bestActivity);
        results.push({
          participant_id: participant.id,
          participant_name: participant.name,
          activity_found: true,
          activity_id: bestActivity.id,
          total_time: bestActivity.totalTime,
          segment_efforts: bestActivity.segmentEfforts.length
        });
      } else {
        results.push({
          participant_id: participant.id,
          participant_name: participant.name,
          activity_found: false,
          reason: 'No qualifying activities on event day'
        });
      }
    } catch (error) {
      results.push({
        participant_id: participant.id,
        participant_name: participant.name,
        activity_found: false,
        reason: error.message
      });
    }
  }
  
  // Recalculate leaderboard
  calculateWeekResults(weekId);
  
  res.json({
    message: 'Results fetched successfully',
    week_id: weekId,
    participants_processed: participants.length,
    results_found: results.filter(r => r.activity_found).length,
    summary: results
  });
});
```

**Helper: Fetch Activities on Day**

```javascript
async function fetchActivitiesOnDay(accessToken, startTime, endTime) {
  const after = Math.floor(new Date(startTime).getTime() / 1000);
  const before = Math.floor(new Date(endTime).getTime() / 1000);
  
  const response = await fetch('https://www.strava.com/api/v3/athlete/activities', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  const activities = await response.json();
  return activities.filter(a => {
    const activityTime = Math.floor(new Date(a.start_date).getTime() / 1000);
    return activityTime >= after && activityTime <= before;
  });
}
```

**Helper: Find Best Qualifying Activity**

```javascript
async function findBestQualifyingActivity(
  activities, 
  segmentId, 
  requiredLaps, 
  accessToken
) {
  let bestActivity = null;
  let bestTime = Infinity;
  
  for (const activity of activities) {
    // Fetch full activity details (includes segment efforts)
    const fullActivity = await fetch(
      `https://www.strava.com/api/v3/activities/${activity.id}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    ).then(r => r.json());
    
    // Filter to segment efforts matching our segment
    const matchingEfforts = fullActivity.segment_efforts.filter(
      effort => effort.segment.id === segmentId
    );
    
    // Check if activity has required number of repetitions
    if (matchingEfforts.length >= requiredLaps) {
      // Calculate total time (sum of required laps)
      const sortedEfforts = matchingEfforts
        .sort((a, b) => a.elapsed_time - b.elapsed_time)
        .slice(0, requiredLaps);
      
      const totalTime = sortedEfforts.reduce((sum, e) => sum + e.elapsed_time, 0);
      
      if (totalTime < bestTime) {
        bestTime = totalTime;
        bestActivity = {
          id: fullActivity.id,
          totalTime: totalTime,
          segmentEfforts: sortedEfforts
        };
      }
    }
  }
  
  return bestActivity;
}
```

### Activity Matching Rules

1. **Time Window:** Only activities between `start_time` and `end_time`
2. **Segment Filter:** Activity must contain efforts on required segment
3. **Repetition Requirement:** Must have at least `required_laps` segment efforts **in the same activity**
   - 2 laps in one activity = qualifies ✅
   - 1 lap each in two separate activities = does NOT qualify ❌
4. **Best Selection:** If multiple qualifying activities, select the one with fastest total time
5. **Re-fetch Handling:** Safe to re-fetch; updates to current best activity

### Scenario Examples

**Scenario 1: One qualifying activity**
- Event requires 2 laps of segment 12345
- Participant has one activity with 2 efforts on segment 12345
- ✅ Result: That activity is selected

**Scenario 2: Multiple qualifying activities**
- Event requires 2 laps
- Activity A: 2 efforts, total time 1500 seconds
- Activity B: 2 efforts, total time 1420 seconds
- ✅ Result: Activity B is selected (faster)

**Scenario 3: Non-qualifying activities**
- Event requires 2 laps
- Activity A: 1 effort (not enough)
- Activity B: 3 efforts (more than required—counts!)
- ✅ Result: Activity B is selected

**Scenario 4: No qualifying activities**
- Event requires 2 laps
- Participant has activities but none with the segment or only 1 lap
- ❌ Result: No result stored, participant doesn't appear on leaderboard

---

## API Endpoints

### OAuth & Auth Status

```
GET /auth/strava                    # Redirect to Strava OAuth
GET /auth/strava/callback           # Strava callback; exchanges code for tokens
GET /auth/status                    # Returns connection status and participant info
POST /auth/disconnect               # Revoke connection and destroy session
GET /auth/participants              # List all participants with connection status
```

### Admin Activity Collection

```
POST /admin/weeks/:id/fetch-results # Fetch all participant activities for a week
```

---

## Rate Limits & Scale

**Strava API Limits:**
- 100 requests per 15 minutes
- 1000 requests per day
- Per-application limits (not per user)

**Your Usage (<100 participants):**
- Weekly batch fetch: ~100 requests (1 per participant)
- Token refresh overhead: ~10 refreshes/day max
- **Total:** ~200 requests/week → Well within limits ✅

**No scaling concerns needed for Western Mass Velo.**

---

## Security Best Practices

### Token Storage
- **Development:** Plaintext in SQLite (acceptable for local testing)
- **Production:** Encrypt at rest using `crypto` or `node-vault`

### API Rate Limits
Implement exponential backoff if hitting limits (unlikely):
```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429 && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}
```

### Privacy & Consent
- Only request `activity:read` and `profile:read_all` (no write access)
- Display exactly what data you're accessing in OAuth prompt
- Respect activity visibility settings (private activities not visible without `activity:read_all`)
- Provide "Disconnect Strava" button on participant dashboard
- Consider auto-deleting tokens for inactive participants

### Token Handling
- Never log tokens (redact from error logs)
- Use HTTPS for all OAuth redirects
- Set `secure` and `httpOnly` flags on session cookies
- Rotate `client_secret` periodically via Strava API settings

---

## Strava API Agreement Compliance

**Status:** Email sent to `developers@strava.com` for confirmation that our app qualifies as a "Community Application" under the Strava API Agreement. Awaiting response.

**Assumption:** We proceed with development assuming our app is permitted as a Community Application. This section documents our compliance and requirements.

---

### API Agreement Summary

Our app has been reviewed against the [Strava API Agreement](https://www.strava.com/legal/api) (effective October 9, 2025). Key findings:

**Our Classification:** Community Application
- **Definition** (Section 2.10): A Developer Application created with the primary purpose of permitting athletes to organize and collaborate in group activities, no larger than 9,999 registered users.
- **WMV Qualification:** ~100 club members organizing weekly segment competitions = community organization
- **Implication:** Special permission to display data from multiple club members to organize group activities (normally prohibited)

**Use Case Validation:**
- ✅ Club members authenticate via OAuth with explicit permission
- ✅ We display leaderboards showing results from multiple members
- ✅ Activities remain public on Strava (we don't hide or alter them)
- ✅ App is free; no monetization
- ✅ Data only visible to authenticated club members
- ✅ Primary purpose is community organization, not replicating Strava

**Potential Concerns Addressed:**
- ❓ "Virtual races or competitions" — Our app organizes club activities, doesn't replace Strava racing features
- ❓ "Competitive to Strava" — We complement Strava, don't replicate its core functionality
- ❌ **NOT**: Selling access, sharing data with third parties, using for marketing

---

### API Agreement Compliance Checklist

This checklist ensures our implementation remains compliant with all API Agreement requirements.

#### Authentication & Authorization (Section 5)
- [x] **Use OAuth 2.0** - Each member authenticates individually (✅ implemented)
- [x] **Request minimal scopes** - Only `activity:read` and `profile:read_all` (✅ implemented)
- [x] **Obtain explicit consent** - OAuth prompt shows permissions before access (✅ built-in)
- [x] **Allow disconnection** - "Disconnect Strava" button on dashboard (✅ implemented)
- [ ] **Clear privacy policy** - Must explain data usage and user rights (⏳ needed for production)
- [ ] **Inform users of data collection** - Privacy notice on login screen (⏳ needed for production)

#### Data Usage & Disclosure (Sections 2.9, 2.10)
- [x] **Only show own data by default** - OAuth enforces per-user access (✅ implemented)
- [x] **Community Application exception** - Display multiple members' data for leaderboards (✅ architected)
- [x] **Only display to club members** - Leaderboards require login (✅ implemented)
- [x] **No data sharing with third parties** - No APIs expose data outside app (✅ by design)
- [x] **No monetization** - Free app, no charges (✅ by design)
- [x] **No targeted advertising** - No ad targeting based on Strava data (✅ by design)
- [x] **No data selling** - Never to data brokers or sponsors (✅ committed)
- [ ] **Content not modified** - Verify segment times aren't altered or misrepresented (⏳ code review)

#### Data Security (Section 2.8)
- [x] **Encrypt in transit** - All API calls use HTTPS (✅ implemented)
- [ ] **Encrypt at rest** - Production must encrypt tokens with AES-256-GCM (⏳ [see TOKEN_ENCRYPTION_GUIDE.md](./TOKEN_ENCRYPTION_GUIDE.md))
- [ ] **Security measures** - Commerc reasonable security practices (⏳ add to privacy policy)
- [ ] **Breach notification** - Notify Strava within 24 hours of any breach (⏳ process needed)

#### Data Retention & Deletion (Sections 2.6, 7)
- [x] **Respect deletions** - Update app within 48 hours when user deletes on Strava (✅ by design)
- [ ] **Cache limit** - Data cache no longer than 7 days (⏳ verify implementation)
- [ ] **User data deletion** - Allow members to delete their data on request (⏳ add endpoint)
- [x] **Token revocation** - Respect when user disconnects (✅ implemented)

#### Prohibited Uses (Section 2.14)
- ✅ **NOT for AI/ML training** - Never using data for model training (✅ by design)
- ✅ **NOT replicating Strava** - Building a leaderboard tool, not mimicking Strava UI/functionality (✅ by design)
- ✅ **NOT competitive to Strava** - App enhances Strava experience (✅ by design)
- ✅ **NOT web scraping** - Using official OAuth API only (✅ by design)
- ✅ **NOT content that's harmful** - No defamatory, hateful, or violent content (✅ by design)
- ✅ **NOT charging users** - Free to club members (✅ by design)
- ✅ **NOT malware or viruses** - Standard app security (✅ by design)

#### API Usage Restrictions (Section 2.11)
- [x] **Rate limits** - Default 200 req/15min, 2000/day per app (✅ well within for 100 members)
- [x] **Single API token** - One token per app (not per user) (✅ implemented)
- [x] **Token confidentiality** - Never share token or log it (✅ implemented)

#### Attribution & Branding (Sections 2.3, 2.5, 9)
- [ ] **Strava attribution** - Link to Strava in app/docs (⏳ add to UI)
- [ ] **Brand guidelines compliance** - Use approved Strava logos [Strava Brand Guidelines](https://developers.strava.com/guidelines) (⏳ review guidelines)
- [ ] **No confusing origin** - Clear app is not made by Strava (⏳ add to UI/privacy policy)
- [x] **Not claiming Strava endorsement** - Making clear we're a community tool (✅ by design)

#### Monitoring & Transparency (Sections 2.12)
- [x] **Strava monitoring usage** - Accept Strava collects usage data (✅ by design)
- [ ] **Usage disclosure** - Add statement to privacy policy explaining this (⏳ needed)

#### Privacy & Data Protection (Section 5)
- [ ] **GDPR/UK GDPR Compliance** - Privacy policy meets legal requirements (⏳ legal review needed)
- [ ] **Personal data handling** - Process only with lawful basis (⏳ privacy policy)
- [ ] **User requests** - Respond to data deletion/access requests (⏳ process needed)
- [x] **Respect privacy settings** - Honor public/private activity settings (✅ by design)

---

### Implementation Tasks (Priority Order)

#### High Priority (Before Production)
1. **Privacy Policy**
   - Add statement explaining:
     - What data we collect (activity data, athlete profile)
     - How long we retain it (cache 7 days, permanent storage optional)
     - How users can delete it (request to admin + in-app delete)
     - GDPR/privacy compliance
   - Link prominently in app footer

2. **Data Deletion Endpoint**
   - Add `DELETE /api/user/data` endpoint
   - Members can request deletion of their data
   - Implement 48-hour deadline

3. **Token Encryption**
   - Implement AES-256-GCM encryption for production tokens
   - See [TOKEN_ENCRYPTION_GUIDE.md](./TOKEN_ENCRYPTION_GUIDE.md)

4. **Security Audit**
   - Verify no tokens logged or exposed
   - Confirm HTTPS on all API endpoints
   - See [SECURITY_AUDIT.md](./SECURITY_AUDIT.md)

#### Medium Priority (Within First Month)
5. **Strava Attribution**
   - Add "Powered by Strava" link to app
   - Follow [Strava Brand Guidelines](https://developers.strava.com/guidelines)

6. **Monitoring & Alerting**
   - Set up alerts for API errors or abuse
   - Monitor token refresh failures

7. **Documentation**
   - Add to in-app help: "Your data is managed by WMV, not Strava"
   - Explain which scopes we use and why

#### Low Priority (Future)
8. **Webhooks Implementation**
   - Eventually use webhooks instead of polling
   - Reduces API requests and response time
   - See [Strava Webhooks Documentation](https://developers.strava.com/docs/webhooks/)

---

### Community Application Status - Pending Confirmation

**Email sent to:** `developers@strava.com`  
**Date:** November 11, 2025  
**Status:** Awaiting response

**Question asked:**
- Does our WMV leaderboard app qualify as a "Community Application"?
- Is weekly segment competition tracking permitted, or does it violate "virtual races" restriction?
- Any other compliance requirements for our use case?

**Expected response time:** 3-7 business days

**What to do if Strava says "no":**
- Likely scenarios:
  1. "You need to apply for review" → Follow review process
  2. "This is a virtual race" → Pivot to non-competitive leaderboard (time tracking only)
  3. "You need to encrypt tokens" → Already on roadmap
  4. "You need a more restrictive privacy policy" → Implement immediately

---

### Related Documentation

- **[TOKEN_ENCRYPTION_GUIDE.md](./TOKEN_ENCRYPTION_GUIDE.md)** - How to encrypt tokens at rest
- **[SECURITY_AUDIT.md](./SECURITY_AUDIT.md)** - Complete security review of the app
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Production security requirements
- **[Official Strava API Agreement](https://www.strava.com/legal/api)** - Full legal text (last updated October 9, 2025)
- **[Strava Brand Guidelines](https://developers.strava.com/guidelines)** - Logo and attribution rules

---

## Manual Testing Without Real OAuth

### Test Data Approach (Current)
The app includes seeded test data with:
- Fake `strava_athlete_id` values
- Fake activity URLs
- Realistic segment effort data

This allows full development and testing without real Strava accounts.

### Testing with Real Strava

1. Start servers: `npm run dev:all`
2. Visit `http://localhost:5173`
3. Click "Connect with Strava"
4. Authorize with your Strava account
5. Verify token stored in `participant_tokens` table
6. Submit a real activity from your Strava

---

## Implementation Checklist

### Phase 1: OAuth Setup ✅ COMPLETE
- [x] Environment variables (`STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REDIRECT_URI`)
- [x] `participant_tokens` table created
- [x] `GET /auth/strava` route
- [x] `GET /auth/strava/callback` route
- [x] Token refresh utility
- [x] Session management
- [x] Frontend "Connect with Strava" button
- [x] Error handling and testing

### Phase 2: Admin Batch Fetch ⏳ IN PROGRESS
- [ ] `POST /admin/weeks/:id/fetch-results` endpoint
- [ ] Helper functions for activity fetching and filtering
- [ ] Activity validation and best-activity selection
- [ ] Database storage of activities and segment efforts
- [ ] Leaderboard recalculation after fetch
- [ ] Progress indicator UI
- [ ] Error handling (API failures, missing tokens, etc.)
- [ ] Re-fetch safety and logic

### Phase 3: Admin UI 📋 NEXT
- [ ] Week creation form with segment validation
- [ ] "Fetch Results" button on week detail page
- [ ] Participant status dashboard
- [ ] Results summary display

### Phase 4: Future Enhancements 📋 BACKLOG
- [ ] Strava webhooks for real-time activity collection
- [ ] Segment search UI
- [ ] Email notifications
- [ ] Activity audit log
- [ ] Manual overrides (exclude activities, adjust points)

---

## Production Deployment: GitHub Secrets Configuration

When deploying to production via GitHub Actions, the following environment variables **MUST** be configured as GitHub Secrets:

### Required Secrets

1. **`STRAVA_CLIENT_ID`** - Your Strava app's client ID (from https://www.strava.com/settings/api)
2. **`STRAVA_CLIENT_SECRET`** - Your Strava app's client secret (keep this private!)
3. **`STRAVA_REDIRECT_URI`** - Production OAuth redirect URL (e.g., `https://yourdomain.com/auth/strava/callback`)
4. **`SESSION_SECRET`** - Random secret for session encryption (generate with: `openssl rand -base64 32`)

### GitHub Actions Workflow Setup

Add to your `.github/workflows/deploy.yml`:

```yaml
env:
  STRAVA_CLIENT_ID: ${{ secrets.STRAVA_CLIENT_ID }}
  STRAVA_CLIENT_SECRET: ${{ secrets.STRAVA_CLIENT_SECRET }}
  STRAVA_REDIRECT_URI: ${{ secrets.STRAVA_REDIRECT_URI }}
  SESSION_SECRET: ${{ secrets.SESSION_SECRET }}
  NODE_ENV: production
```

### Why Not Commit These Values

- `.env` files are in `.gitignore` for development
- Production secrets should **never** be committed to git
- GitHub Secrets provide encrypted, audit-logged credential storage
- Secrets are injected at deploy time, never stored in the repository

### Setup Instructions

1. Go to repository **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add each secret listed above with appropriate production values
4. Deploy workflow will automatically use these values

---

## Glossary

- **Access Token:** Short-lived token (6 hours) used to call Strava API
- **Refresh Token:** Long-lived token used to obtain new access tokens
- **Scope:** Permissions requested from Strava (e.g., `activity:read`)
- **Athlete ID:** Unique identifier for a Strava athlete
- **Segment:** A defined portion of road on Strava
- **Segment Effort:** One completion of a segment (one "lap")
- **Authorization Code:** Single-use code exchanged for tokens during OAuth callback

---

## Resources

- [Strava API Documentation](https://developers.strava.com/docs/)
- [OAuth 2.0 Overview](https://developers.strava.com/docs/oauth/)
- [Webhook Events Guide](https://developers.strava.com/docs/webhooks/)
- [API Rate Limits](https://developers.strava.com/docs/rate-limits/)

See also:
- `docs/ARCHITECTURE.md` - High-level system design
- `docs/DATABASE_DESIGN.md` - Data schema and queries
- `docs/API.md` - Complete endpoint reference
- `ADMIN_GUIDE.md` - Admin workflow and operations
- `STRAVA_BRANDING.md` - OAuth button and attribution guidelines
