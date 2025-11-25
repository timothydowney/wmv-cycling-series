# Local Webhook Testing Guide

**UPDATED: November 25, 2025**

Testing webhooks in development without needing ngrok, Strava, or real activities. Use the webhook event emitter tool to send test events to your local app.

---

## Quick Start

### 1. Start Your Dev Servers

```bash
npm run dev:all
```

This starts both backend (port 3001) and frontend (port 5173) with hot reload.

### 2. Send a Test Webhook Event

In a **separate terminal**, run:

```bash
node scripts/webhook-emitter.cjs --event create
```

That's it! You should see:
- ✅ Event sent to http://localhost:3001/webhooks/strava (200 OK response)
- 📊 Backend logs show event received and processed
- 🎯 Check the database → `webhook_event` table for the logged event
- 📈 Navigate to Admin Panel → Webhooks → Event History to see the event with raw JSON payload

---

## Simple Testing: Direct Event Emitter

The webhook emitter is a Node.js CLI tool that sends realistic Strava webhook payloads to your local backend. It automatically loads your `.env` file to include the verify token.

```bash
# Send a 'create' event (activity submitted)
node scripts/webhook-emitter.cjs --event create

# Send a 'delete' event (activity removed)
node scripts/webhook-emitter.cjs --event delete

# Send an 'update' event (activity modified)
node scripts/webhook-emitter.cjs --event update

# Send athlete deauth event (user revoked access)
node scripts/webhook-emitter.cjs --event athlete_deauth
```

### Customize Participant and Activity IDs

```bash
# Use specific athlete ID (from your test database)
node scripts/webhook-emitter.cjs --event create --athlete-id 366880

# Use specific activity ID
node scripts/webhook-emitter.cjs --event create --activity-id 123456789

# Both
node scripts/webhook-emitter.cjs --event create --athlete-id 366880 --activity-id 123456789
```

### Use Custom Webhook URL

```bash
# If you've configured a different URL
node scripts/webhook-emitter.cjs --event create --url http://localhost:3001/webhooks/strava
```

### Load Events from File

```bash
# Send all events from the test fixture file
node scripts/webhook-emitter.cjs --file scripts/webhook-test-events.json

# Send with delay between events (1 second)
node scripts/webhook-emitter.cjs --file scripts/webhook-test-events.json --delay 1000
```

### Verbose Logging

```bash
# See full request/response details
node scripts/webhook-emitter.cjs --event create --verbose
```

### Get Help

```bash
node scripts/webhook-emitter.cjs --help
```

---

## Built-In Events

The emitter includes several pre-configured test events:

### `create` - Activity Submitted
```
Participant completes an activity during the event window.
This is the most common scenario.

Expected behavior:
- Activity fetched from Strava API
- Matched to current week
- Stored in database
- Leaderboard updated
```

### `update` - Activity Modified
```
Participant edits activity details (name, description, etc).

Expected behavior:
- Activity re-fetched from Strava
- Results recalculated
- Leaderboard refreshed
```

### `delete` - Activity Removed
```
Participant deletes an activity from Strava.

Expected behavior:
- Activity removed from database
- Segment efforts deleted
- Results deleted
- Leaderboard recalculated
```

### `athlete_deauth` - User Revokes Access
```
Participant clicks "Revoke Access" in Strava settings.

Expected behavior:
- OAuth tokens deleted
- Participant marked as disconnected
- Can reconnect later via OAuth
```

---

## Test Event Fixtures

Predefined test scenarios in `scripts/webhook-test-events.json`:

1. **Single Activity (Happy Path)** - Standard scenario
2. **Multiple Activities** - Tests best-activity selection
3. **Different Participant** - Tests multi-participant processing
4. **Update Activity** - Tests re-processing
5. **Delete Activity** - Tests cleanup
6. **Athlete Deauth** - Tests token deletion
7. **Outside Time Window** - Tests time validation (should reject)
8. **No Matching Week** - Tests event for non-existent week (should log as info)

Load all fixtures:
```bash
node scripts/webhook-emitter.cjs --file scripts/webhook-test-events.json --delay 500
```

This sends all events with 500ms delay between them, simulating a batch of activities arriving over time.

---

## Testing Workflow

### Scenario 1: Test Basic Activity Processing

```bash
# Terminal 1: Start dev servers
npm run dev:all

# Terminal 2: Create a test season/week via the admin panel
# (Navigate to http://localhost:5173, create Week 1 for today)

# Terminal 3: Send a test activity
node scripts/webhook-emitter.cjs --event create --athlete-id 366880 --activity-id 123456789

# Terminal 2: Check results
# - Backend logs should show event processing
# - Check http://localhost:5173 leaderboard for activity
# - Check database: SELECT * FROM activity WHERE strava_activity_id = 123456789
```

### Scenario 2: Test Activity Deletion

```bash
# Terminal 1: Already running dev servers

# Terminal 2: Send delete event for activity created above
node scripts/webhook-emitter.cjs --event delete --activity-id 123456789

# Terminal 3: Verify activity deleted from leaderboard
# - Leaderboard should refresh
# - Activity should disappear
# - Check database: SELECT COUNT(*) FROM activity WHERE strava_activity_id = 123456789 (should be 0)
```

### Scenario 3: Test Retry Logic

Simulate a failed event by stopping the server mid-processing:

```bash
# Terminal 1: Start dev servers
npm run dev:all

# Terminal 2: Send create event
node scripts/webhook-emitter.cjs --event create --athlete-id 366880 --activity-id 123456789

# Terminal 3: Quickly stop servers (Ctrl+C)
# Event will be marked as failed in webhook_event table

# Terminal 4: Restart servers
npm run dev:all

# Terminal 5: Check event status in database
# SELECT * FROM webhook_event WHERE object_id = 123456789

# Terminal 5: Use admin panel to retry failed event
# Or send event again (emitter will reprocess)
```

### Scenario 4: Multi-Event Stream

Simulate multiple participants submitting activities:

```bash
# Terminal 1: Start dev servers
npm run dev:all

# Terminal 2: Send batch of test events
node scripts/webhook-emitter.cjs --file scripts/webhook-test-events.json --delay 1000

# Terminal 3: Watch backend logs to see processing order
# Events are processed sequentially (concurrency=1)
```

---

## Database Verification

After sending webhook events, verify they were processed:

```bash
# Check webhook events were received
sqlite3 server/data/wmv.db "SELECT id, aspect_type, object_type, processed, error_message FROM webhook_event ORDER BY created_at DESC LIMIT 5;"

# Check activities were stored
sqlite3 server/data/wmv.db "SELECT id, strava_activity_id, strava_athlete_id, validation_status FROM activity ORDER BY created_at DESC LIMIT 5;"

# Check results were calculated
sqlite3 server/data/wmv.db "SELECT id, week_id, strava_athlete_id, total_time_seconds FROM result ORDER BY created_at DESC LIMIT 5;"

# Check segment efforts
sqlite3 server/data/wmv.db "SELECT id, activity_id, elapsed_seconds, pr_achieved FROM segment_effort ORDER BY created_at DESC LIMIT 5;"
```

Or use a SQLite GUI:
```bash
# Open SQLite browser
sqlite3 server/data/wmv.db

# Then run SQL queries interactively
.tables
.headers on
.mode column
SELECT * FROM webhook_event LIMIT 5;
```

---

## Troubleshooting

### "Failed to send webhook: Connection refused"

**Problem:** Your backend isn't running on port 3001

**Solution:**
```bash
npm run dev:all
```

Or check if port 3001 is in use:
```bash
lsof -i :3001
```

### "Webhook rejected: 503 Service Unavailable"

**Problem:** `WEBHOOK_ENABLED` env var isn't set to 'true'

**Solution:** Check `.env`:
```bash
grep WEBHOOK_ENABLED .env
```

Should output:
```
WEBHOOK_ENABLED=true
```

### Event sent but nothing appears in database

**Possible Issues:**

1. **Activity doesn't match any week**
   - Check week time windows: `SELECT * FROM week;`
   - Make sure test activity timestamp falls within a week's start_at/end_at
   - Event logs show "No matching weeks" - this is normal if no weeks exist

2. **Participant not connected**
   - Check if athlete_id has OAuth tokens: `SELECT * FROM participant_token WHERE strava_athlete_id = 366880;`
   - Use a participant from your test data that has valid tokens

3. **Event processing failed**
   - Check webhook_event table: `SELECT error_message FROM webhook_event ORDER BY created_at DESC LIMIT 1;`
   - Check backend logs for stack traces

### "Unknown event type"

**Problem:** You specified an invalid event name

**Solution:** List available events:
```bash
node scripts/webhook-emitter.cjs --help
```

Or check `scripts/webhook-test-events.json` for fixture names.

---

## Advanced: Custom Test Events

Create your own test scenario by editing `scripts/webhook-test-events.json`:

```json
{
  "events": [
    {
      "name": "My Custom Event",
      "description": "Description of what this tests",
      "payload": {
        "aspect_type": "create",
        "event_time": 1732464600,
        "object_id": 9876543210,
        "object_type": "activity",
        "owner_id": 366880,
        "subscription_id": 1
      }
    }
  ]
}
```

Then send it:
```bash
node scripts/webhook-emitter.cjs --file scripts/webhook-test-events.json
```

**Tips:**
- `event_time`: Unix timestamp (seconds since epoch). Use `Math.floor(Date.now() / 1000)` for current time
- `owner_id`: Must match a participant with valid OAuth tokens in your database
- `object_id`: Activity ID (any unique number, Strava won't validate it)
- `subscription_id`: Should match your webhook subscription (usually 1)

---

## Strategy: Testing Scoring & Behavior

Before going to production with real Strava, we need to test that webhook events trigger the correct scoring and leaderboard behavior. This requires:

1. **Real test participants** in the database with valid tokens
2. **Real test weeks** created for specific dates
3. **Webhook events** that match those weeks' time windows
4. **Verification** that activities are stored and leaderboard calculates correctly

### Phase 1: Setup (One-time)

**Goal:** Create test infrastructure that mirrors production

**Steps:**

1. **Create test participants in database**
   - Insert directly via SQL or via OAuth with test Strava accounts
   - Need: `strava_athlete_id`, `name`, `participant_token` record with valid access token
   - Example SQL:
     ```sql
     INSERT INTO participant (name, strava_athlete_id) VALUES ('Test User 1', 123456789);
     INSERT INTO participant_token (strava_athlete_id, access_token, refresh_token, expires_at, scope)
       VALUES (123456789, '<token>', '<refresh>', <timestamp>, 'activity:read');
     ```

2. **Create test weeks**
   - Use Admin UI or API to create weeks
   - Pick specific dates/times you'll use for testing
   - Example: "Test Week 1" on 2025-12-01 from 00:00:00 to 22:00:00 UTC
   - Use a real Strava segment ID (e.g., segment 1234567)
   - Set `required_laps: 1` (simplifies testing)

3. **Seed mock activity data**
   - For each test participant, create mock activities in `activity` and `segment_effort` tables
   - This simulates what would be fetched from Strava
   - Makes leaderboard queryable before webhooks

**Note:** We'll implement this setup script in the next chat. For now, focus on design.

### Phase 2: Test Scoring Logic

**Goal:** Verify that webhook events update leaderboard scores correctly

**Test Cases:**

#### Test 2A: Single Activity - Baseline Scoring
```
Setup:
  - 3 participants (A, B, C) with test accounts
  - Week 1 created for today, 00:00-22:00 UTC
  - No activities yet (empty leaderboard)

Actions:
  1. Send create webhook for Participant A (activity, time=1000s)
  2. Send create webhook for Participant B (activity, time=900s)
  3. Send create webhook for Participant C (activity, time=1100s)

Expected Results:
  - Leaderboard order: B (1st, 900s), A (2nd, 1000s), C (3rd, 1100s)
  - Scores: B=3pts, A=2pts, C=1pt (each beats N people + 1 for competing)
  - All activities visible in Event History with raw JSON payloads
```

#### Test 2B: Multiple Activities - Best Selection
```
Setup:
  - Same as 2A

Actions:
  1. Send create for Participant A: activity 1 (time=1000s)
  2. Send create for Participant A: activity 2 (time=900s) [faster]
  3. Check leaderboard

Expected Results:
  - Participant A should have activity 2 selected (900s, not 1000s)
  - Leaderboard should only show the faster time
  - Old activity 1 still in database but not used for scoring
```

#### Test 2C: Activity Update - Recalculation
```
Setup:
  - Participant A has activity with time=1000s on leaderboard

Actions:
  1. Update the activity time (modify segment effort or activity details)
  2. Send update webhook for the same activity

Expected Results:
  - Leaderboard rank/scores recalculated
  - New timing reflected if fetched from Strava
```

#### Test 2D: Activity Deletion - Cleanup
```
Setup:
  - Participant A on leaderboard with activity (1st place, 3pts)
  - Participant B on leaderboard (2nd place, 2pts)

Actions:
  1. Send delete webhook for Participant A's activity

Expected Results:
  - Activity removed from database
  - Segment efforts deleted (cascade)
  - Results deleted (cascade)
  - Leaderboard recalculated: B now 1st with updated points
  - Participant A disappears from leaderboard (no activity)
```

#### Test 2E: Time Window Enforcement
```
Setup:
  - Week 1 time window: 2025-12-01 00:00 to 22:00 UTC only

Actions:
  1. Send create webhook with timestamp BEFORE week starts (2025-11-30 23:00 UTC)
  2. Send create webhook with timestamp AFTER week ends (2025-12-02 00:00 UTC)
  3. Send create webhook within window (2025-12-01 12:00 UTC)

Expected Results:
  - First two rejected (not in time window)
  - Third accepted and on leaderboard
  - Event History shows all 3 events with their status
```

#### Test 2F: No Matching Week
```
Setup:
  - No weeks created for tomorrow

Actions:
  1. Send create webhook with tomorrow's timestamp

Expected Results:
  - Event logged (not errored)
  - Marked as processed but activity not stored
  - Backend log shows "No matching weeks"
  - Leaderboard unaffected
```

#### Test 2G: Participant Not Found
```
Setup:
  - Activity from non-existent athlete ID

Actions:
  1. Send create webhook for athlete_id not in participants table

Expected Results:
  - Event logged as processed
  - No error
  - Activity not stored (participant doesn't exist)
  - Leaderboard unaffected
```

### Phase 3: Event History Verification

**Goal:** Verify Event History panel displays events correctly

**Test Cases:**

#### Test 3A: Raw JSON Display
```
Actions:
  1. Send webhook event (any type)
  2. Go to Admin → Webhooks → Event History
  3. Click "Raw JSON" button on event card

Expected Results:
  - Full webhook payload displayed as formatted JSON
  - Readable, monospace font
  - All fields visible: aspect_type, event_time, object_id, owner_id, etc.
  - Toggle works without page reload
```

#### Test 3B: Formatted View
```
Actions:
  1. Same event from 3A
  2. Click "Formatted" button

Expected Results:
  - Key fields extracted and displayed:
    - Aspect: ➕ create / ♻️ update / 🗑️ delete
    - Object: 🚴 activity / 👤 athlete
    - IDs: participant, activity, etc.
    - Timestamp: readable date/time
    - Updates: field names that changed (for update events)
```

#### Test 3C: Error Display
```
Actions:
  1. Send event that causes processing error (e.g., bad athlete ID)
  2. Check Event History

Expected Results:
  - Event shows with ✕ status (red border)
  - Error banner displays error message
  - Both Raw and Formatted views available even for failed events
```

### Phase 4: Batch Processing

**Goal:** Verify multiple events process correctly in sequence

**Test Case:**
```
Actions:
  1. Load and send all events from webhook-test-events.json with 500ms delay
  2. Watch backend logs
  3. Check Event History panel
  4. Verify leaderboard updates

Expected Results:
  - All events processed in order
  - Each visible in Event History
  - Leaderboard reflects final state
  - No race conditions or conflicts
```

---

## Implementation Plan for Next Chat

**Deliverables:**

1. **Seeding Script** (`scripts/seed-webhook-test-data.ts`)
   - Creates test participants with valid token records
   - Creates test weeks
   - Seeds initial activities if needed
   - Idempotent (can run multiple times)

2. **Enhanced Webhook Emitter** (update `scripts/webhook-emitter.ts`)
   - Add scenario/profile flags: `--scenario=scoring-baseline`, `--scenario=multiple-activities`, etc.
   - Auto-fetch test participant IDs from database
   - Auto-adjust event_time to match test week windows
   - Option to create activities with specific elapsed_time values
   - Better output summary comparing leaderboard before/after

3. **Test Checklist** (markdown file)
   - Step-by-step for each test case
   - SQL queries to verify database state
   - Screenshots/expected UI state
   - Checkboxes for manual verification

4. **Monitoring Tool** (optional)
   - Script to continuously watch webhook_event table
   - Display new events and their processing status in real-time
   - Helpful for tracking batch operations

---



## Production vs. Development

| Aspect | Development | Production |
|--------|-------------|-----------|
| **Webhook Emitter** | ✅ Use local CLI tool | ❌ Not used |
| **Event Source** | CLI emitter | Real Strava API |
| **Verify Token** | From `.env` | From `.env` (Railway secrets) |
| **Callback URL** | `http://localhost:3001/webhooks/strava` | `https://your-app.railway.app/webhooks/strava` |
| **Testing** | `npm run webhook:emit` | Real participant activities |

---

## Related Documentation

- **[WEBHOOKS.md](./WEBHOOKS.md)** - Complete webhook architecture and flow
- **[STRAVA_INTEGRATION.md](./STRAVA_INTEGRATION.md)** - OAuth and token management
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Production webhook configuration
- **[ADMIN_GUIDE.md](../ADMIN_GUIDE.md)** - Admin operations and testing
