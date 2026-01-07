# Admin Troubleshooting

Common issues and how to fix them.

## Login & Access Issues

### I Can't Access the Admin Panel
**Problem:** You log in but don't see "Manage Competition" or "Manage Segments"

**Possible causes:**
1. You're not an admin (yet)
2. Your athlete ID isn't in the admin list
3. You're not logged in properly

**Fix:**
1. Verify you're logged in (see your name in top right)
2. Ask the organization lead to add your Strava athlete ID to the admin list
3. Log out and log in again
4. Try a different browser or clear cache

**To find your ID:**
1. Go to [Strava.com](https://strava.com)
2. Visit your profile (click your name in top right)
3. Look at the URL: `https://www.strava.com/athletes/YOUR_ID`
4. Share that ID with the lead

### I Keep Getting Logged Out
**Problem:** Sessions expire quickly

**Possible causes:**
1. Browser cookies are disabled
2. Private browsing mode (cookies don't persist)
3. Browser cache is cleared

**Fix:**
- Enable cookies in your browser settings
- Use normal (non-private) browsing
- Try a different browser
- Clear cache but keep cookies

## Creating Weeks

### Segment ID Not Found
**Problem:** "Invalid segment ID" error when creating a week

**Possible causes:**
1. Incorrect ID (wrong number)
2. Typo in the ID
3. Segment doesn't exist on Strava
4. No participants connected yet

**Fix:**
1. Double-check the segment ID from Strava
2. Retype or copy-paste carefully
3. Verify on Strava that segment exists
4. Ask at least one participant to connect first

**Correct format:** Just the number, nothing else. Example: `23456789`

### Week Won't Save
**Problem:** "Error saving week" message

**Possible causes:**
1. Missing required field (name, date, segment, reps)
2. Invalid date format
3. Invalid rep count (must be positive number)
4. Server error (temporary issue)

**Fix:**
- Check all fields are filled in
- Ensure date is in correct format (YYYY-MM-DD)
- Ensure "required reps" is a positive number like 1, 2, 5
- Try saving again
- Contact technical support if persists

### Week Created But Doesn't Appear
**Problem:** You created a week but it's not on the website

**Possible causes:**
1. Page needs to be refreshed
2. Week creation failed silently
3. Time window hasn't opened yet

**Fix:**
1. Refresh the page (Ctrl+R or Cmd+R)
2. Go to "Manage Competition" to verify it was saved
3. Check if today is past the start time

## Fetching Results

### No Results Found (Expected Some)
**Problem:** Fetch completes but shows "0 results found"

**Possible causes:**
1. No participants connected
2. Participants rode outside the time window
3. Participants rode the wrong segment
4. Activities haven't synced from Strava yet
5. Strava is temporarily down

**Fix:**
1. Check "Participant Status" - who's connected?
2. Ask participants if they rode during the event window
3. Verify segment ID is correct
4. Wait 15-30 minutes (Strava sync delay) and try again
5. Ask participants to manually upload on Strava

### Wrong Times on Leaderboard
**Problem:** Times don't match what Strava shows

**Possible causes:**
1. We're summing segment effort times (different than activity total)
2. Segment ID was wrong (different segment than expected)
3. Strava's metadata is different from our calculation

**Fix:**
1. Refresh the page
2. Verify segment ID
3. Ask a technical lead to investigate (this is a rare edge case)

### Missing Participants
**Problem:** Someone rode but doesn't appear

**Possible causes:**
1. They're not connected to Strava
2. Their activity is private on Strava
3. They rode the wrong segment
4. They didn't complete required reps
5. They rode outside the time window
6. Their activity hasn't synced yet

**Fix:**
1. Ask them directly: "Did you complete the segment on [date]?"
2. Check that their Strava activity is public or follower-visible
3. Verify they rode the correct segment
4. Ask them to verify they did all required reps in one activity
5. Check that they rode within the time window
6. Wait 15-30 minutes and re-fetch (Strava sync)

### Fetch Fails with Error
**Problem:** "Error fetching results" message

**Possible causes:**
1. Strava API is temporarily down
2. No connected participants (can't fetch without at least one)
3. Server error (temporary)

**Fix:**
1. Wait 5-10 minutes (Strava might be down)
2. Ask participants to connect first
3. Try again
4. Contact technical support if persistent

## Managing Segments

### Segment Already in Database
**Problem:** You try to add a segment but it says "already exists"

**Possible causes:**
1. You already added this segment
2. Another admin already added it
3. It was used in a past event

**Fix:**
1. Check the segment list - it's probably already there
2. You don't need to add it again
3. Just use it when creating a new week

### Segment Validation Fails
**Problem:** "Segment not found on Strava"

**Possible causes:**
1. Segment ID is wrong
2. Segment was deleted on Strava
3. No participants connected (can't validate without them)

**Fix:**
1. Double-check the segment ID
2. Verify on Strava that segment still exists
3. Ask a participant to connect first
4. Try validating again

### Segment Data Looks Wrong
**Problem:** Segment name, distance, or grade is incorrect

**Possible causes:**
1. Strava's data is different
2. Old cached data (before recent Strava updates)
3. Segment was updated on Strava

**Fix:**
1. Click "Refresh" on the segment to update
2. Click "Refresh All" to update all segments
3. Verify on Strava directly if discrepancy persists

## Performance Issues

### Website is Slow
**Problem:** Pages load slowly, especially leaderboards

**Possible causes:**
1. High traffic on the site
2. Server is overloaded
3. Your internet connection
4. Browser has too many tabs open

**Fix:**
1. Try again in a few minutes
2. Close other browser tabs
3. Try a different browser
4. Check your internet connection
5. Contact technical support

### Leaderboard Doesn't Update
**Problem:** You fetched results but the leaderboard doesn't show new data

**Possible causes:**
1. Browser cache (old version still displayed)
2. Page needs to be refreshed
3. Fetch failed silently

**Fix:**
1. Refresh the page (Ctrl+R or Cmd+R)
2. Clear browser cache (or use Ctrl+Shift+R for hard refresh)
3. Try fetching again
4. Close and reopen browser

## Data Issues

### Duplicate Results
**Problem:** Participant appears twice with different times

**Possible causes:**
1. They rode twice and both activities counted
2. System error (rare)

**Fix:**
1. This shouldn't happen (we pick fastest)
2. If it does, contact technical support
3. They can manually edit results while we fix it

### Participant Data Looks Wrong
**Problem:** Name, profile, or rank is incorrect

**Possible causes:**
1. They changed their Strava profile
2. Data hasn't synced
3. They reconnected with a different account

**Fix:**
1. Ask them to verify their Strava profile
2. Wait 5 minutes and refresh
3. Ask them to disconnect and reconnect
4. Contact technical support if persistent

## Getting More Help

**For technical issues:**
1. Check the [Learning](/learn) section for scoring and how things work
2. Ask a team member who's used the system before
3. Contact the technical lead or app developer
4. Check the [GitHub repository](https://github.com/timothydowney/wmv-cycling-series) for known issues

**For participant issues:**
1. Answer their questions from the [Athlete FAQ](/athlete/faq)
2. Walk them through connecting to Strava
3. Help them verify their activities are public

---

Still stuck? Ask your organization's technical lead or contact the development team!
