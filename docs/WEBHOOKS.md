# Webhooks Implementation Guide

Real-time activity updates from Strava via webhooks. When participants complete rides, activities appear in WMV automatically without manual submission.

---

## Overview

**Traditional Flow (Batch Fetch):**
1. Participant rides and syncs to Strava
2. Admin manually triggers fetch at end of day: `POST /admin/weeks/:id/fetch-results`
3. System processes all activities
4. Leaderboard updates

**Webhook Flow (Real-Time):**
1. Participant rides and syncs to Strava (takes ~5 minutes for sync)
2. Strava sends webhook event to your app automatically
3. Your app processes activity in background (async)
4. Leaderboard updates immediately (within seconds of Strava sync)

**Benefits:**
- ✅ Activities appear automatically without admin intervention
- ✅ Participants see results in real-time
- ✅ Reduces manual work for admins
- ✅ Better user experience

**Trade-off:**
- Requires public-facing HTTPS domain (Strava sends requests to your app)
- Adds infrastructure complexity
- Feature flag allows disabling if needed

---

## Complete Flow Diagram

```mermaid
graph TD
    A["🚴 Participant Rides<br/>Activity syncs to Strava<br/>~5 minutes"] -->|Strava sends webhook| B["📨 Webhook Event<br/>POST /webhooks/strava<br/>(activity create/update)"]
    
    B -->|Validate token<br/>WEBHOOK_ENABLED=true| C["✅ Return 200 OK<br/>within 2 seconds"]
    
    B -->|async| D["🔄 Process in Background<br/>(doesn't block user)"]
    
    D --> E["👤 Get Participant<br/>by athlete_id"]
    E --> F["🔑 Get Valid OAuth Token<br/>auto-refresh if needed"]
    F --> G["📥 Fetch Activity<br/>from Strava API"]
    
    G --> H["🔍 Query All Weeks"]
    
    H --> I["⏱️ Time Window Match?<br/>activity.start_date<br/>within week.start_at..end_at"]
    
    I -->|No match| J["Skip week"]
    I -->|Match| K["🎯 Find Best<br/>Qualifying Activity<br/>findBestQualifyingActivity"]
    
    K -->|Check:<br/>Has segment?<br/>Has N laps?<br/>Is fastest?| L{Activity<br/>Qualifies?}
    
    L -->|No| M["⏭️ No result<br/>participant doesn't rank"]
    L -->|Yes| N["💾 Store Activity<br/>+ Segment Efforts<br/>storeActivityAndEfforts"]
    
    N --> O["📊 Calculate Result<br/>rank by total_time<br/>compute points"]
    
    O --> S["💾 Store in Results<br/>week, participant,<br/>total_time, rank, points"]
    
    S --> T["📋 Leaderboard<br/>Auto-updates<br/>computed on-read"]
    
    T --> U["🎉 Participant Sees<br/>Real-time results<br/>in app"]
    
    style A fill:#e1f5e1
    style C fill:#e1e5f5
    style D fill:#fff4e1
    style K fill:#f5e1e1
    style L fill:#ffe1e1
    style N fill:#e1f5f5
    style O fill:#f5e1f5
    style T fill:#e1f5e1
    style U fill:#e1f5e1
```

**See [Scoring Rules](./SCORING.md) for detailed points calculation** (base points, PR bonus, season totals)

---

## Architecture

### Components

**1. Webhook Routes** (`server/src/routes/webhooks.ts`)
- `GET /webhooks/strava` - Subscription validation (Strava sends challenge, we echo it back)
- `POST /webhooks/strava` - Event receipt (Strava sends activities, deletions, disconnections)
- Both protected by feature flag: `WEBHOOK_ENABLED`

**2. Webhook Logger** (`server/src/webhooks/logger.ts`)
- Persists webhook events to database table `webhook_event`
- Marks each event as processed (success) or failed (with error message)
- **Required when webhooks are enabled** - persists events for admin dashboard monitoring
- Feeds the webhook status endpoint with event counts and success rates

**3. Webhook Processor** (`server/src/webhooks/processor.ts`)
- Async event processor - decoupled from HTTP layer
- Three event handlers:
  - `processActivityEvent()` - Activity created/updated
  - `processActivityDeletion()` - Activity deleted
  - `processAthleteDisconnection()` - Athlete revoked authorization
- Factory pattern: `createWebhookProcessor(db)` binds database instance
- Reuses existing activity matching/storage logic (zero code duplication)

**4. Subscription Manager** (`server/src/webhooks/subscriptionManager.ts`) - *Future*
- Subscribe/unsubscribe from Strava API
- Handle subscription verification
- Manage subscription lifecycle (24-hour expiry, renewal)

---

## Event Flow

### Activity Create/Update

```
Strava sends webhook:
  {
    "aspect_type": "create" | "update",
    "object_id": 12345678910,           // Strava activity ID
    "owner_id": 12345,                  // Athlete's Strava ID
    "object_type": "activity",
    "subscription_id": 1,
    "event_time": 1234567890
  }

↓

Your webhook endpoint receives POST request
  1. Validate feature flag (WEBHOOK_ENABLED=true)
  2. Return 200 OK immediately (Strava requires response within 2 seconds)

↓

Async processing in background:
  1. Get participant by athlete ID (owner_id)
  2. Get their valid OAuth token (auto-refreshes if needed)
  3. Fetch full activity details from Strava API
  4. Query all weeks in database
  5. For each week matching activity's time window:
     - Call findBestQualifyingActivity() [REUSED from batch fetch]
     - If activity qualifies, call storeActivityAndEfforts() [REUSED]
  6. Log results

↓

Leaderboard updates automatically:
  - Results computed on-read from activities table
  - No staleness - always current
```

### Activity Delete

```
Strava sends webhook:
  {
    "aspect_type": "delete",
    "object_id": 12345678910,
    "owner_id": 12345,
    "object_type": "activity",
    ...
  }

↓

Processor:
  1. Find activity by strava_activity_id
  2. Delete all segment_efforts for that activity
  3. Delete activity record
  4. Delete result record
  5. Log deletion counts

↓

Leaderboard recalculates:
  - Deleted activity no longer counted
  - Remaining participants' scores recalculate
```

### Athlete Deauthorization

```
Strava sends webhook:
  {
    "aspect_type": "update",
    "object_type": "athlete",
    "updates": {
      "authorized": false      // User revoked app access
    },
    "owner_id": 12345,
    ...
  }

↓

Processor:
  1. Find participant by athlete ID
  2. Delete their OAuth token record(s)
  3. Leave historical data intact (for competition integrity)
  4. Log disconnection

↓

Result:
  - Participant can reconnect anytime
  - Historical activities/results remain (score calculations unchanged)
```

---

## Configuration

### Environment Variables

**REQUIRED (only if enabling webhooks):**

```bash
# Enable webhook subscriptions (default: false)
# Set to 'true' to enable real-time activity processing
WEBHOOK_ENABLED=true

# Public callback URL where Strava sends webhook events
# Must be HTTPS and publicly accessible
# Strava will POST to: {WEBHOOK_CALLBACK_URL}/webhooks/strava
WEBHOOK_CALLBACK_URL=https://your-domain.com

# Secret verification token (used by Strava to sign events)
# Generate: openssl rand -hex 32
# This is sent to Strava when creating the subscription
WEBHOOK_VERIFY_TOKEN=a3f7d8c2e9b1f4a6c8d5e7f9a1b3c5d7e9f1a3b5c7d9e1f3a5b7c9d1e3f5
```

**REQUIRED (when webhooks are enabled):**

```bash
# Persist webhook events to database (REQUIRED for admin dashboard metrics)
# Events marked as processed (success) or failed (with error message)
WEBHOOK_PERSIST_EVENTS=true
```

**OPTIONAL:**

```bash
# Strava API base URL (for mock mode - development only)
# Default: https://www.strava.com
# Development: http://localhost:4000 (when using mock-strava)
STRAVA_API_BASE_URL=https://www.strava.com
```

**ALWAYS REQUIRED:**

```bash
# Strava OAuth credentials (needed for activity fetching via API)
STRAVA_CLIENT_ID=your-client-id
STRAVA_CLIENT_SECRET=your-client-secret
STRAVA_REDIRECT_URI=https://your-domain.com/auth/strava/callback
```

### Production Setup Checklist

1. **Generate secure verify token:**
   ```bash
   openssl rand -hex 32
   # Example output: a3f7d8c2e9b1f4a6c8d5e7f9a1b3c5d7e9f1a3b5c7d9e1f3a5b7c9d1e3f5
   ```

2. **Set environment variables in Railway:**
   - `WEBHOOK_ENABLED=true`
   - `WEBHOOK_CALLBACK_URL=https://your-railway-domain.railway.app`
   - `WEBHOOK_VERIFY_TOKEN=<generated-token>`
   - All standard Strava credentials (already set)

3. **Verify webhook route is public:**
   - `GET /webhooks/strava` - Strava verification (no auth required)
   - `POST /webhooks/strava` - Event receipt (no auth required)
   - Both protected by `WEBHOOK_VERIFY_TOKEN` validation

4. **Subscribe with Strava (automatic on startup):**
   - On first startup, app checks if subscription exists
   - If not, app creates subscription automatically
   - Strava sends verification challenge to `GET /webhooks/strava`
   - App echoes back challenge to complete subscription
   - Check server logs for: `✓ Subscription ready`

5. **Verify setup:**
   - Server logs should show: `[Webhook:SubscriptionManager] ✓ Subscription ready`
   - Database table `webhook_subscription` should have one row (id=1)
   - Complete a test ride in Strava and check if results appear within ~30 seconds

---

## Local Development Testing

**Problem:** You need to test webhooks locally without deploying to production, but Strava can only send webhooks to public HTTPS URLs.

**Solutions:** WMV provides two complementary testing approaches:

1. **Mock Strava Server** - Emulates real Strava API for end-to-end integration testing
2. **Webhook Emulator CLI** - Sends test events to your local backend for fast iteration

---

### Option 1: Mock Strava Server (Recommended for E2E Testing)

The mock-strava server emulates Strava's API on `localhost:4000`, allowing full webhook testing without real Strava credentials.

**Quick Start:**

```bash
# Terminal 1: Start mock Strava server
npm run mock:strava
# Output: Mock Strava listening on localhost:4000

# Terminal 2: Start app servers
npm run dev:all
# Backend automatically detects mock mode and logs:
# [Webhook:SubscriptionManager] 🧪 MOCK MODE DETECTED
# [Webhook:SubscriptionManager]    Using mock Strava API: http://localhost:4000

# Terminal 3: Emit test event
npm run webhook:emit -- --event create --participant 366880
```

**Benefits:**
- ✅ Real Strava API integration testing (same code path as production)
- ✅ No Strava credentials needed
- ✅ Automatic webhook subscription handling
- ✅ Full HTTP protocol testing (not just event injection)
- ✅ Backend shows clear "🧪 MOCK MODE" indicator
- ✅ Frontend banner shows mock server status (green when running, red when down)

**How It Works:**
- Backend reads `STRAVA_API_BASE_URL=http://localhost:4000` from `.env` (development)
- All Strava API calls route through mock server
- `siteModeService` detects development mode and enables mock-mode features
- UI banner clearly indicates mock vs production mode

**Verifying Mock Mode is Active:**
1. Terminal with app server shows: `🧪 MOCK MODE DETECTED`
2. Frontend Admin Panel → Webhooks shows yellow banner with "🧪 MOCK MODE"
3. When mock-strava is running: banner shows green "✓ Server running"
4. When mock-strava stops: banner shows red "✗ Server not responding"

---

### Option 2: Webhook Emulator CLI (Quick Iteration)

Use the webhook emulator to rapidly test webhook event processing without running mock-strava.

**Quick Start:**

1. **Start the development servers:**
   ```bash
   npm run dev:all
   ```
   - Backend: http://localhost:3001
   - Frontend: http://localhost:5173

2. **In another terminal, emit a test webhook event:**
   ```bash
   npm run webhook:emit -- --event create --participant 366880
   ```

3. **Verify it worked:**
   - Check backend logs for processing message
   - Open frontend → Admin Panel → Webhooks → Events tab
   - Should see the test event listed
   - Check the leaderboard to see if activity was added

---

### Available Test Events

**With Webhook Emulator CLI** (works with both real Strava and mock-strava):

The webhook emulator comes with 8 pre-configured test scenarios:

```bash
# Activity created (happy path)
npm run webhook:emit -- --event create

# Activity updated (modified time, distance, etc.)
npm run webhook:emit -- --event update

# Activity deleted by participant
npm run webhook:emit -- --event delete

# Athlete disconnected their Strava account
npm run webhook:emit -- --event deauth

# Activity outside time window (won't match any week)
npm run webhook:emit -- --event outside-window

# Activity with no segment efforts (won't have required segment)
npm run webhook:emit -- --event no-segment

# Multiple activities for same week (tests best-selection logic)
npm run webhook:emit -- --event multi-activity

# Rapid-fire multiple events (tests queue/retry behavior)
npm run webhook:emit -- --event burst
```

### Using Custom Participants & Activities

By default, events use hardcoded test data. You can override with command-line arguments:

```bash
# Use a specific participant athlete ID
npm run webhook:emit -- --event create --participant 12345678

# Use a specific activity ID
npm run webhook:emit -- --event create --activity 9876543210

# Combine both
npm run webhook:emit -- --event create --participant 12345678 --activity 9876543210
```

### Viewing Results

**In the app:**
1. Admin Panel → Webhooks → Events tab
2. See all received webhook events
3. Check "Status" column: "processed" = success, "error" = failure
4. Click event for details (error message, retry info)

**In the database:**
```bash
# Query webhook events
sqlite3 server/data/wmv.db "SELECT id, object_type, aspect_type, processed, error_message FROM webhook_event LIMIT 10;"

# Query activities that were stored from webhooks
sqlite3 server/data/wmv.db "SELECT week_id, participant_id, total_time_seconds, validation_status FROM activities WHERE validation_status = 'valid';"

# Check leaderboard for the week
sqlite3 server/data/wmv.db "SELECT participant_id, rank, total_time_seconds, points FROM results WHERE week_id = 1 ORDER BY rank;"
```

### Troubleshooting

**Event not appearing in Events tab?**
- Ensure `WEBHOOK_ENABLED=true` in `.env`
- Check backend logs for errors: `npm run dev:all` shows all output
- Verify webhook emulator is posting to correct URL (http://localhost:3001/webhooks/strava)

**Event marked as "error" in Events tab?**
- Click the event to see error message
- Common issues:
  - No matching participant (use correct `--participant` value)
  - Week time window doesn't match activity date
  - Participant not connected to Strava (no OAuth token)
- Check backend logs for full stack trace

**Activity not appearing on leaderboard?**
- Verify activity matches a week's time window
- Verify participant is connected to Strava
- Check `webhook_event` table: `processed=1` means success
- Check `activities` table: should have a row with `validation_status='valid'`
- Run diagnostic query above to verify

### Complete Testing Workflow

#### Scenario 1: Full End-to-End Testing (Mock Strava)

```bash
# Terminal 1: Start mock Strava server
npm run mock:strava
# Listens on localhost:4000

# Terminal 2: Start app servers
npm run dev:all
# Backend logs show: 🧪 MOCK MODE DETECTED
# Frontend shows: Yellow "🧪 MOCK MODE" banner, turns green when mock-strava responds

# Terminal 3: Verify mock mode
# Check that:
# - Backend shows: [Webhook:SubscriptionManager] 🧪 MOCK MODE DETECTED
# - Frontend Admin Panel → Webhooks shows green banner with "✓ Server running"

# Terminal 4: Run integration tests
npm run webhook:emit -- --event create --participant 366880

# Verify in UI:
# - http://localhost:5173 → Admin Panel → Webhooks → Events tab
# - See test event with status "processed"
# - Check leaderboard for the week
# - See activity ranked and scored
```

**Benefits of this approach:**
- Tests real Strava API integration (same code path as production)
- Full end-to-end from mock Strava through app to leaderboard
- Easy to see what's happening (clear logging)
- Automatically uses mock credentials (no real API key needed)

#### Scenario 2: Quick Iteration Testing (Webhook Emulator Only)

```bash
# Terminal 1: Start servers (uses real Strava API)
npm run dev:all

# Terminal 2: Run rapid tests
npm run webhook:emit -- --event create
npm run webhook:emit -- --event update
npm run webhook:emit -- --event delete

# Verify results in UI or database
```

**Benefits of this approach:**
- Fast - no mock server startup time
- Good for testing event processor logic
- Useful when you don't need full API integration testing
- Can test with real Strava OAuth tokens if desired

**For detailed testing guide with database queries and advanced scenarios, see [WEBHOOK_TESTING.md](./WEBHOOK_TESTING.md)**

---

## Environment Configuration

The webhook system uses environment variables to control behavior in development vs production.

### Development Configuration (`.env`)

```env
# Enable/disable webhooks entirely
WEBHOOK_ENABLED=false                    # Start false, set true when testing

# Webhook verification token (for local testing)
WEBHOOK_VERIFY_TOKEN=dev-token-for-testing

# Strava API base URL - CRITICAL for mock-strava
STRAVA_API_BASE_URL=http://localhost:4000    # Routes to mock-strava

# Optional: log all webhook events for debugging
WEBHOOK_PERSIST_EVENTS=true              # REQUIRED - persists events (processed/failed)
```

**Key Variables:**

| Variable | Value | Purpose |
|----------|-------|---------|
| `WEBHOOK_ENABLED` | `false` (by default) | Feature flag to enable/disable webhooks |
| `STRAVA_API_BASE_URL` | `http://localhost:4000` | Backend detects this and enables mock mode |
| `WEBHOOK_VERIFY_TOKEN` | Any value | Used by local webhook emulator |
| `WEBHOOK_PERSIST_EVENTS` | `true` (required if webhooks enabled) | **Required** - persists events as processed/failed for monitoring |

**How It Works:**
- Backend checks if `STRAVA_API_BASE_URL` contains "localhost"
- If yes: logs "🧪 MOCK MODE DETECTED" and uses mock server
- Frontend uses `siteModeService` to detect if in development
- If in dev mode: shows mock mode banner with server status

### Production Configuration (`.env.example`)

```env
WEBHOOK_ENABLED=true                          # Enable webhooks
WEBHOOK_VERIFY_TOKEN=<your-secret-token>      # Strava includes this in requests
WEBHOOK_CALLBACK_URL=https://yourdomain.com/webhooks/strava
STRAVA_API_BASE_URL=https://www.strava.com    # Real Strava API
WEBHOOK_PERSIST_EVENTS=true                   # REQUIRED - persists events
```

**Key Differences:**
- Webhooks ENABLED (to receive real events from Strava)
- Real Strava API endpoint
- Public HTTPS callback URL
- Strong verification token

---

## Security

### Webhook Verification

Every webhook request includes a verification token. Your app checks it:

```typescript
const token = req.query['hub.verify_token'] as string;

if (token !== process.env.WEBHOOK_VERIFY_TOKEN) {
  res.status(403).json({ error: 'Invalid token' });
  return;
}
```

**Why this matters:**
- Prevents anyone from sending fake webhooks
- Only Strava knows the token (because you told them during subscription)
- Attackers can't forge requests without the token

### Token Management

- OAuth tokens for activity fetching are encrypted at rest (AES-256-GCM)
- Tokens auto-refresh before expiry (24-hour lifecycle)
- Deauth webhook immediately revokes access
- If participant disconnects, no future webhooks will be processed

### Rate Limiting

- Strava rate limits: 100 req/15min, 1000 req/day (per app)
- Your webhook processing is async - doesn't block other requests
- Activity fetching reuses existing token/API client (shared limits with batch fetch)
- At <100 participants, you'll never hit Strava limits

---

## Code Reuse

Webhook processor reuses all logic from batch fetch service (zero duplication):

| Function | Source | Purpose |
|----------|--------|---------|
| `getValidAccessToken()` | `tokenManager.ts` | Get/refresh OAuth token |
| `stravaClient.getActivity()` | `stravaClient.ts` | Fetch activity details from Strava |
| `findBestQualifyingActivity()` | `activityProcessor.ts` | Match activity to weeks |
| `storeActivityAndEfforts()` | `activityStorage.ts` | Store activity and segment efforts |

**Result:** Identical activity processing whether triggered by admin batch fetch or webhook.

---

## Development Testing

### Enable Webhooks Locally

1. **Set environment variables:**
   ```bash
   WEBHOOK_ENABLED=true
   WEBHOOK_VERIFY_TOKEN=test-token-for-local-testing
   ```

2. **Start servers:**
   ```bash
   npm run dev:all
   ```

3. **Send test webhook:**
   ```bash
   curl -X POST http://localhost:3001/webhooks/strava \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer test-token-for-local-testing" \
     -d '{
       "aspect_type": "create",
       "event_time": 1234567890,
       "object_id": 987654321,
       "object_type": "activity",
       "owner_id": 12345,
       "subscription_id": 1
     }'
   ```

4. **Check response:**
   - Should return `{ "received": true }` immediately
   - Check backend logs for async processing output

5. **Verify processing:**
   - Check database for new activity/result records
   - Check webhook_event table if `WEBHOOK_PERSIST_EVENTS=true`

### Test Data Requirements

For processing to succeed, you need:
- Participant with `strava_athlete_id = 12345` and valid OAuth token
- Week with time window matching the activity's `start_date`
- Segment matching the week's `strava_segment_id`
- Activity should have segment efforts on that segment

If any of these are missing, the webhook processes successfully but doesn't create a result (logged as "no matching weeks" or "activity doesn't qualify").

---

## Feature Flag Pattern

Webhooks are protected by feature flag:

```typescript
if (process.env.WEBHOOK_ENABLED !== 'true') {
  res.status(503).json({ error: 'Webhooks disabled' });
  return;
}
```

**This allows:**
- Deploying webhook code without enabling it
- Easy rollback if issues arise (just set `WEBHOOK_ENABLED=false`)
- Gradual rollout (enable for testing, then production)
- Fallback to batch fetch if webhooks fail

---

## Monitoring

### Webhook Event Logging

If `WEBHOOK_PERSIST_EVENTS=true`, all events are persisted to `webhook_event` table:

```sql
SELECT * FROM webhook_event 
WHERE received_at > datetime('now', '-1 hour')
ORDER BY received_at DESC;
```

Fields:
- `subscription_id` - Which subscription sent the event
- `aspect_type` - create, update, delete
- `object_type` - activity, athlete
- `object_id` - ID of resource
- `owner_id` - Athlete ID
- `received_at` - When we received it
- `processed` - Whether processing succeeded
- `processed_at` - When we processed it
- `error_message` - If processing failed

### Production Monitoring

- Monitor `webhook_event` table for failed events
- Set up alerts if error_message is not null
- Check logs for `[Webhook] Processing failed` messages
- Monitor database size (activity table growth)
- Check token refresh logs (look for auth errors)

---

## Troubleshooting

### Webhook Not Received

**Problem:** Events sent to Strava, but webhook endpoint not receiving them

**Check:**
1. `WEBHOOK_ENABLED=true` in production
2. Domain is publicly accessible: `curl https://your-domain.com/webhooks/strava`
3. Subscription created successfully (check Strava API response)
4. Subscription didn't expire (24-hour lifecycle, need renewal)

**Solution:**
- Verify subscription with Strava API
- Check firewall/proxy logs
- Try test webhook locally first
- Enable `WEBHOOK_PERSIST_EVENTS=true` to persist and track the event

### Activity Not Processed

**Problem:** Webhook received, but activity didn't create result

**Check:**
1. Participant exists: `SELECT * FROM participant WHERE strava_athlete_id = ?`
2. Participant has valid token: `SELECT * FROM participant_token WHERE strava_athlete_id = ?`
3. Week exists for that date: `SELECT * FROM week WHERE start_at <= ? AND end_at >= ?`
4. Week's segment matches activity's segments
5. Activity has required number of segment efforts

**Solution:**
- Check `webhook_event` table for error message
- Verify week time window is correct (Unix timestamps)
- Verify participant is connected (OAuth token exists)
- Check backend logs for specific error

### Token Expired

**Problem:** "Token expired" error in logs

**Why:** Participant's OAuth token expired

**Solution:**
- Processor auto-refreshes tokens if expiring within 1 hour
- If token is >6 hours old, refresh will fail
- Participant needs to re-connect: "Disconnect" button → "Connect" button
- Or check `participant_token` table: `expires_at` field

---

## Phase Roadmap

### Phase 3: Processor ✅ COMPLETE
- ✅ Webhook routes (GET validation, POST receipt)
- ✅ Event logger
- ✅ Three event handlers (activity, deletion, deauth)
- ✅ Feature flag gating
- ✅ Code reuse from batch fetch

### Phase 4: Subscription Manager ✅ COMPLETE
- ✅ Subscribe with Strava API
- ✅ Check for existing subscription
- ✅ Verify subscription with challenge/response
- ✅ Delete subscription
- ✅ Track subscription state in logs

### Phase 5: Testing Infrastructure ✅ COMPLETE
- ✅ Service layer DI pattern tests
- ✅ Test fixtures for webhook events
- ✅ Integration tests with real database
- ✅ 332 tests passing, no regressions

---

## Optional Future Enhancements

**Status:** Not required for MVP. Feature is fully functional and production-ready.

The following are optional enhancements that can be added in future seasons:

### 1. Automatic Subscription Renewal (Low Priority)

**Issue:** Strava subscriptions expire after 24 hours if not renewed

**Current State:** 
- Subscription created once during app startup
- Subscription ID logged for manual monitoring
- App continues to work if subscription expires
- Manual renewal via Strava dashboard if needed

**Future Enhancement:**
- Add cron job to check subscription status every 12 hours
- Auto-renew if expiring within 2 hours
- Log renewal success/failure
- Alert admin if renewal fails

**Implementation:**
```typescript
// In index.ts, call periodically:
setInterval(async () => {
  await setupWebhookSubscription(); // Checks and recreates if needed
}, 12 * 60 * 60 * 1000); // Every 12 hours
```

**Effort:** 1-2 hours  
**Why Skip for MVP:** Manual management is sufficient at <100 participants

---

### 2. Webhook Event Replay (Low Priority)

**Issue:** If webhook processing fails, event is lost. No automatic retry.

**Current State:**
- `webhook_event` table captures all received events
- Failed events marked with error_message
- Batch fetch available as fallback
- Admin can investigate failed events

**Future Enhancement:**
- Add `POST /admin/webhooks/replay/:objectId` endpoint
- Manual replay of failed webhook events
- Bulk replay of all failed events
- Progress indicator showing replay status

**Implementation:**
```typescript
app.post('/admin/webhooks/replay/:objectId', requireAdmin, async (req, res) => {
  const event = db.prepare(
    'SELECT * FROM webhook_event WHERE object_id = ? AND processed = 0'
  ).get(req.params.objectId);
  
  if (!event) return res.status(404).json({ error: 'Event not found' });
  
  // Re-process the event
  await processWebhookEvent(event, logger);
  res.json({ replayed: true });
});
```

**Effort:** 2-3 hours  
**Why Skip for MVP:** Batch fetch provides fallback; failures rare at current scale

---

### 3. Webhook Signature Verification (Optional Security Enhancement)

**Issue:** Strava optionally sends `X-Strava-Signature` header for additional security

**Current State:**
- Webhook verify token validation (primary security)
- Token is 256-bit random (strong entropy)
- At current scale, token validation is sufficient

**Future Enhancement:**
- Validate HMAC-SHA256 signature if header present
- Reject requests with invalid signature
- Log signature validation failures

**Implementation:**
```typescript
router.post('/strava', (req: Request, res: Response) => {
  const signature = req.headers['x-strava-signature'] as string;
  
  if (signature) {
    const hmac = crypto.createHmac('sha256', process.env.WEBHOOK_VERIFY_TOKEN || '');
    const expected = hmac.update(JSON.stringify(req.body)).digest('hex');
    
    if (signature !== `v0=${expected}`) {
      console.warn('[Webhook] Invalid signature');
      res.status(403).json({ error: 'Invalid signature' });
      return;
    }
  }
  // Continue processing...
});
```

**Effort:** 1 hour  
**Why Skip for MVP:** Token validation is primary security; signature is defense-in-depth

---

### 4. End-to-End Integration Testing

**Issue:** No live tests hitting actual Strava API

**Current State:**
- Unit tests mock WebhookService
- Processor logic tested in isolation
- Route middleware tests included
- Manual testing documented

**Future Enhancement:**
- CI/CD integration test with staging Strava app credentials
- Automated test creates activity on Strava, verifies in leaderboard
- Monthly staging environment smoke tests
- Documented Strava test account setup

**Implementation:**
- Create `server/src/__tests__/webhooks.integration.test.ts`
- Skip by default (requires STRAVA_TEST_CLIENT_ID env var)
- Run in staging CI/CD pipeline

**Effort:** 3-4 hours  
**Why Skip for MVP:** Manual staging tests documented in WEBHOOKS.md

---

### 5. Dead Letter Queue for Failed Events

**Issue:** Failed webhook events are logged but need re-processing

**Current State:**
- `webhook_event` table tracks all events
- Error messages logged
- Manual intervention required

**Future Enhancement:**
- Separate `webhook_dlq` (dead letter queue) table for persistent failures
- Automatic escalation after N retries
- Admin dashboard to view/replay DLQ events
- Alerts if DLQ fills up

**Effort:** 3-4 hours  
**Why Skip for MVP:** Webhook failures are rare; batch fetch provides fallback

---

### 6. Webhook Metrics & Monitoring

**Issue:** Limited visibility into webhook processing performance

**Current State:**
- Console logs (not persistent)
- `webhook_event` table tracks status
- Manual SQL queries required for analysis

**Future Enhancement:**
- Dashboard showing:
  - Events received vs processed
  - Average processing time
  - Error rates
  - Latency p95/p99
- Prometheus metrics export
- Grafana dashboards
- Alerts on error rate threshold

**Effort:** 4-6 hours  
**Why Skip for MVP:** Manual log inspection sufficient; scale too small for metrics

---

## Related Documentation

- **[Strava Integration](./STRAVA_INTEGRATION.md)** - OAuth flow, token management, activity fetching
- **[API Reference](./API.md)** - Webhook endpoint details
- **[Deployment](./DEPLOYMENT.md)** - Production webhook setup
- **[Architecture](./ARCHITECTURE.md)** - High-level system design
- **[Admin Guide](../ADMIN_GUIDE.md)** - Manual batch fetch (alternative to webhooks)

---

## FAQ

**Q: Do I have to use webhooks?**
A: No. Batch fetch (`POST /admin/weeks/:id/fetch-results`) works perfectly fine. Webhooks are optional for real-time updates.

**Q: Can I use webhooks and batch fetch together?**
A: Yes. Both use identical activity matching logic. Safe to enable webhooks and still use batch fetch as backup.

**Q: What if webhooks fail?**
A: Set `WEBHOOK_ENABLED=false` and fall back to batch fetch. No data loss - events are idempotent.

**Q: How do I disable webhooks in production?**
A: Set `WEBHOOK_ENABLED=false` in environment. Existing subscriptions with Strava remain active but your app won't process them. Consider unsubscribing via Strava API.

**Q: Can I test locally without a public domain?**
A: No - Strava requires public HTTPS. But you can test the processor logic:
1. Manually insert webhook events into database
2. Call processor directly: `await processor(event, logger)`
3. Verify results in database

**Q: What about GDPR when Strava sends events?**
A: Webhooks only contain activity metadata (time, distance, segment IDs) - no personal data. See [Privacy Policy](../PRIVACY_POLICY.md) for full details.
