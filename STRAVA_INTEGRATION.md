# Participant Strava Integration

## Overview
This document explains how participants in the Western Mass Velo weekly competition will connect their Strava accounts and authorize the app to access their activities.

## Current Status
- ✅ Backend supports storing Strava athlete IDs
- ✅ Test data includes fake Strava IDs for development
- ⏳ OAuth integration pending (see roadmap below)

## OAuth Flow Design (To Be Implemented)

### One-Time Setup Per Participant

#### 1. Participant Connects Account
When a participant first uses the app:
1. Navigate to the app homepage
2. Click "Connect with Strava" button
3. Redirected to Strava's authorization page
4. Grant permissions:
   - **Read activities** - to fetch their submitted activities
   - **Read profile** - to link Strava athlete ID to their participant record
5. Redirected back to our app with authorization code

#### 2. Backend Handles OAuth Exchange
```javascript
// Route: GET /auth/strava/callback?code=...
app.get('/auth/strava/callback', async (req, res) => {
  const { code } = req.query;
  
  // Exchange code for access token + refresh token
  const tokenData = await stravaClient.oauth.getToken(code);
  
  // Get athlete profile
  const athlete = await stravaClient.athletes.getLoggedInAthlete();
  
  // Find or create participant
  const participant = db.prepare(`
    SELECT * FROM participants WHERE strava_athlete_id = ?
  `).get(athlete.id);
  
  if (participant) {
    // Update existing participant's tokens
    updateParticipantTokens(participant.id, tokenData);
  } else {
    // Prompt for name or auto-create from Strava profile
    createParticipant(athlete.id, athlete.firstname + ' ' + athlete.lastname, tokenData);
  }
  
  // Store session/cookie for this participant
  req.session.participantId = participant.id;
  res.redirect('/dashboard');
});
```

#### 3. Token Storage
We need to securely store OAuth tokens for each participant:

```sql
CREATE TABLE IF NOT EXISTS participant_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_id INTEGER NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,  -- Unix timestamp
  scope TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(participant_id) REFERENCES participants(id)
);
```

**Security Note:** In production, tokens should be encrypted at rest.

#### 4. Token Refresh
Strava access tokens expire after 6 hours. Before making API calls:

```javascript
async function getValidToken(participantId) {
  const tokenRecord = db.prepare(`
    SELECT * FROM participant_tokens WHERE participant_id = ?
  `).get(participantId);
  
  const now = Math.floor(Date.now() / 1000);
  
  if (tokenRecord.expires_at < now) {
    // Token expired, refresh it
    const newTokenData = await stravaClient.oauth.refreshToken(tokenRecord.refresh_token);
    
    // Update stored tokens
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
  
  return tokenRecord.access_token;
}
```

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

### Phase 1: OAuth Setup
- [ ] Register app with Strava (get client ID/secret)
- [ ] Add `participant_tokens` table to schema
- [ ] Implement `/auth/strava` redirect route
- [ ] Implement `/auth/strava/callback` exchange route
- [ ] Implement token refresh logic
- [ ] Add session management for logged-in participants

### Phase 2: Activity Submission
- [ ] Build `/weeks/:id/submit-activity` endpoint
- [ ] Extract activity ID from Strava URL
- [ ] Fetch activity details via Strava API using participant's token
- [ ] Validate activity:
  - [ ] Check date matches week's Tuesday
  - [ ] Find segment efforts for week's segment
  - [ ] Verify required number of laps completed
- [ ] Store validated activity and efforts in database
- [ ] Recalculate week's leaderboard

### Phase 3: Frontend UI
- [ ] "Connect with Strava" button on homepage
- [ ] Dashboard showing participant's connection status
- [ ] Weekly objective card with submission form
- [ ] Activity URL input + submit button
- [ ] Validation feedback (success/error messages)
- [ ] Leaderboard with clickable Strava activity links

### Phase 4: Admin Tools (Optional)
- [ ] View all submissions for a week
- [ ] Manually validate/invalidate activities
- [ ] Resend validation for failed activities
- [ ] Participant token management

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
- 100 requests per 15 minutes
- 1000 requests per day

For 10 participants × 2 API calls per submission = 20 calls per week → well within limits.

### Privacy
- Only request minimum necessary scopes
- Allow participants to disconnect/revoke at any time
- Display what data we access in clear terms
- Don't share activity details with other participants (only aggregated results)

## Next Steps
1. Register Strava API application at https://www.strava.com/settings/api
2. Store credentials in `server/.env`:
   ```
   STRAVA_CLIENT_ID=your_client_id
   STRAVA_CLIENT_SECRET=your_client_secret
   STRAVA_REDIRECT_URI=http://localhost:3001/auth/strava/callback
   ```
3. Begin implementing OAuth routes per checklist above
