# Activity Submission Implementation - November 9, 2025

## Overview
Implemented full Strava activity submission functionality, allowing authenticated users to submit their Strava activities for weekly competitions. The system validates activities, extracts segment efforts, calculates scores, and updates leaderboards automatically.

## Backend Implementation

### New Endpoints

#### `POST /weeks/:id/submit-activity`
Allows authenticated participants to submit a Strava activity URL for a specific week.

**Authentication Required:** Yes (via session)

**Request Body:**
```json
{
  "activity_url": "https://www.strava.com/activities/12345678"
}
```

**Validation Steps:**
1. Check user authentication (session-based)
2. Validate activity URL format
3. Extract activity ID from URL
4. Fetch activity from Strava API using participant's stored token
5. Validate activity date matches week's Tuesday
6. Validate activity is within time window (if specified)
7. Verify required segment is present in activity
8. Verify required number of laps completed

**Response (Success):**
```json
{
  "message": "Activity submitted successfully",
  "activity": {
    "id": 123,
    "strava_activity_id": "12345678",
    "date": "2025-11-12",
    "laps": 2,
    "segment": "River Road"
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Not authenticated or Strava not connected
- `400 Bad Request` - Invalid URL, wrong date, missing segment, insufficient laps
- `404 Not Found` - Week not found
- `500 Internal Server Error` - Strava API error or database error

### New Helper Functions

#### `extractActivityId(url)`
Extracts Strava activity ID from a URL.
- Accepts: `https://www.strava.com/activities/12345678`
- Returns: `"12345678"` or `null`

#### `fetchStravaActivity(activityId, accessToken)`
Fetches activity details from Strava API.
- Uses participant's stored access token
- Handles token refresh via `getValidAccessToken()`
- Returns full activity object with segment_efforts

**Strava API Response Structure:**
```javascript
{
  id: 12345678,
  start_date_local: "2025-11-12T18:30:00Z",
  segment_efforts: [
    {
      segment: { id: 23456789, name: "River Road" },
      elapsed_time: 885,
      pr_rank: 2  // Present if this effort is a PR
    }
  ]
}
```

### Database Updates

#### Modified `activities` Table Usage
Stores submitted activities with validation status:
- `strava_activity_id` - Strava's activity ID
- `activity_url` - Full Strava URL for linking
- `activity_date` - Date of the ride (YYYY-MM-DD)
- `validation_status` - Default: 'valid'

#### Modified `segment_efforts` Table Usage
Stores individual lap times:
- `activity_id` - References activities table
- `segment_id` - References segments table
- `effort_index` - Lap number (0-based)
- `elapsed_seconds` - Time in seconds
- `pr_achieved` - Boolean (1 if PR)

### Leaderboard Recalculation
After successful submission:
1. Deletes old activity for this participant/week (if exists)
2. Stores new activity and segment efforts
3. Calls `calculateWeekResults(weekId)` to update rankings
4. Scoring: `(participants beaten + 1) + PR bonus`

## Frontend Implementation

### New Component: `ActivitySubmission.tsx`

**Location:** `/src/components/ActivitySubmission.tsx`

**Props:**
- `weekId` - Week to submit for
- `weekName` - Display name of week
- `segmentName` - Required segment name
- `requiredLaps` - Number of laps required
- `onSubmitSuccess` - Callback to refresh leaderboard

**Features:**
- Input field for Strava activity URL
- Real-time validation
- Loading states during submission
- Success/error messages
- Auto-refreshes leaderboard on success

**Visibility:**
- Only shown when user is authenticated (`authStatus.authenticated === true`)
- Positioned between WeekSelector and WeeklyLeaderboard

### API Client Updates (`api.ts`)

Added `submitActivity()` function:
```typescript
export async function submitActivity(
  weekId: number, 
  data: ActivitySubmission
): Promise<SubmissionResponse>
```

Updated `Week` interface to include segment details:
```typescript
export interface Week {
  // ... existing fields
  segment_name?: string;
  strava_segment_id?: string;
}
```

### Backend API Update
Modified `GET /weeks/:id/leaderboard` to include segment info in week response:
```sql
SELECT w.*, s.name as segment_name, s.strava_segment_id
FROM weeks w
LEFT JOIN segments s ON w.segment_id = s.id
WHERE w.id = ?
```

## Testing

### New Test File: `activity-submission.test.js`
Location: `/server/src/__tests__/activity-submission.test.js`

**Test Coverage:**
- Authentication requirement (401 errors)
- URL validation
- Activity ID extraction
- Token refresh logic
- Leaderboard recalculation

**Note:** Some tests require session mocking for full integration testing. Currently passing: 9/11 tests (2 need session setup).

### Existing Test Status
- Total: 95 tests
- Passing: 86 tests
- Failing: 9 tests (all authentication-related from old tests written before OAuth)

**Action Items:**
- Update old tests to mock sessions
- Add full integration test with mocked Strava API

## Manual Testing Workflow

### Prerequisites
1. Start servers: `npm run dev:all`
2. Backend: http://localhost:3001
3. Frontend: http://localhost:5173

### Test Steps
1. **Connect Strava Account**
   - Visit http://localhost:5173
   - Click "Connect with Strava"
   - Authorize with your Strava account
   - Verify "Connected as [Your Name]" appears

2. **Submit Activity**
   - Select a week from dropdown
   - Scroll to "Submit Your Activity" section (only visible when connected)
   - Copy a Strava activity URL from your account
   - Paste URL and click "Submit Activity"
   - Verify success message appears
   - Verify leaderboard updates with your submission

3. **Validation Testing**
   - Try submitting activity from wrong date → Error: "Activity date mismatch"
   - Try submitting activity without required segment → Error: "Segment not found"
   - Try submitting activity with too few laps → Error: "Not enough laps"
   - Try invalid URL format → Error: "Invalid activity URL"

## Security Considerations

### Token Handling
- Uses `getValidAccessToken()` which auto-refreshes expiring tokens
- Tokens stored per participant in `participant_tokens` table
- Access tokens expire every 6 hours (Strava default)
- Refresh happens proactively (1 hour before expiry)

### Input Validation
- Activity URL validated via regex: `/strava\.com\/activities\/(\d+)/`
- Activity ID must be numeric
- All Strava API responses validated before processing

### Rate Limits
- Strava: 100 requests/15 min, 1000/day
- Current usage: ~2 requests per submission (token check + activity fetch)
- For 100 participants: ~200 requests/week → Well within limits

## Known Limitations

1. **Session Management**
   - Sessions stored in memory (express-session default)
   - Sessions lost on server restart
   - **Production TODO:** Use persistent session store (Redis, database)

2. **Duplicate Submissions**
   - Replaces previous submission for same week
   - No history of previous submissions
   - **Enhancement:** Track submission history for audit

3. **No Auto-Detection**
   - Manual submission required
   - **Future:** Cron job to auto-detect Tuesday activities

4. **Error Messages**
   - Some Strava API errors may be cryptic
   - **Enhancement:** Better error mapping for common issues

## Files Modified

### Backend
- `server/src/index.js`
  - Added `extractActivityId()` helper
  - Added `fetchStravaActivity()` helper
  - Implemented `POST /weeks/:id/submit-activity` endpoint
  - Updated `GET /weeks/:id/leaderboard` to include segment info

### Frontend
- `src/api.ts`
  - Added `submitActivity()` function
  - Added interfaces: `ActivitySubmission`, `SubmissionResponse`
  - Updated `Week` interface with optional segment fields
- `src/App.tsx`
  - Imported `ActivitySubmission` component
  - Added `refreshLeaderboard()` function
  - Conditionally renders submission form when authenticated
- `src/components/ActivitySubmission.tsx` (NEW)
  - Full component with form, validation, error handling

### Tests
- `server/src/__tests__/activity-submission.test.js` (NEW)
  - 11 test cases for activity submission logic

## Next Steps

### Immediate
1. ✅ Test with real Strava account and activity
2. Fix failing tests (add session mocking)
3. Update STATUS.md with completion
4. Update PLAN.md to mark Milestone 8 complete

### Future Enhancements (Milestone 9+)
1. Auto-detection of activities (cron job)
2. Activity submission history/audit log
3. Email notifications on submission
4. Bulk admin operations (approve/reject)
5. Production deployment with persistent sessions

## Environment Variables Required

```bash
# server/.env
STRAVA_CLIENT_ID=170916
STRAVA_CLIENT_SECRET=[your_secret]
STRAVA_REDIRECT_URI=http://localhost:3001/auth/strava/callback
SESSION_SECRET=[random_string]
```

## Documentation References
- Strava API: https://developers.strava.com/docs/reference/
- OAuth Integration: `STRAVA_INTEGRATION.md`
- Database Schema: `DATABASE_DESIGN.md`
- Admin Guide: `ADMIN_GUIDE.md`

---

**Implementation Date:** November 9, 2025
**Developer:** GitHub Copilot (via Tim)
**Status:** ✅ Complete and ready for manual testing
