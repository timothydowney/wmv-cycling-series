# Fetch Results

This is the magic step: collect all participant activities and automatically generate the leaderboard!

## What Happens When You Fetch

The system will:

1. **Find all connected participants** who have Strava linked
2. **Fetch their activities** from the event day (within the time window you set)
3. **Filter to the right segment** - only activities containing the week's segment
4. **Identify the best activity** for each participant (fastest time, all reps in one activity)
5. **Calculate times and points** - fastest time wins the most points
6. **Update the leaderboard** - results appear instantly on the website

All of this happens in seconds, usually within 30 seconds to a minute.

## When to Fetch Results

**Best time:** Within 1-2 hours after the event window closes

**Why then?** 
- Gives late finishers time to upload to Strava
- Still feels fresh and immediate to participants
- You can re-fetch later if needed

**Can you fetch multiple times?**
Yes! If someone shows up late, you can re-fetch and their activity will be added.

## Step-by-Step: Fetch Results

### 1. Go to Manage Competition
Click **"Manage Competition"** in the admin menu.

### 2. Find Your Week
Locate the week you want to fetch results for. You should see:
- Week name
- Event date
- Status (maybe "Pending Results")

### 3. Click "Fetch Results"
Look for a blue button labeled **"Fetch Results"** or an action menu.

![Alt: Fetch Results button location]

Click it.

### 4. Wait for Processing
A progress indicator will show:
- How many participants were checked
- How many results were found
- Which participants had qualifying activities

This usually takes 10-30 seconds.

### 5. Results Posted!
The leaderboard automatically updates. You're done!

### 6. Check the Results
Click on the week to view the leaderboard. Verify:
- The right number of participants appears
- Times look reasonable
- No obvious errors

If something's wrong, see [Troubleshooting](#troubleshooting).

## Understanding the Results Summary

After fetching, you'll see something like:

```
Results Fetched Successfully
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Participants Processed: 12
Results Found: 10
Missing: 2

Top Finishers:
1. Alice - 14:32 (2 reps)
2. Bob - 15:08 (2 reps)
3. Carol - 16:45 (2 reps)

No Activity Found:
- Dave (didn't ride)
- Eve (private activity)
```

### What This Means

| Item | Meaning |
|------|---------|
| **Processed** | Total connected participants checked |
| **Results Found** | Participants with qualifying activities |
| **Missing** | Participants without qualifying activities |
| **Top Finishers** | Fastest participants (ranked) |
| **No Activity** | Why some didn't appear |

### Why Some Don't Appear

Common reasons:
- **Didn't ride** - No Strava activity on event day
- **Wrong segment** - Rode a different route
- **Not enough reps** - Only did 1 rep when 2 were required
- **Outside time window** - Rode at 11 PM when event closed at 10 PM
- **Private activity** - Activity is private on Strava (make it public or follower-visible)

## Re-Fetching Results

If something goes wrong or a participant uploads late:

1. Go back to **Manage Competition**
2. Click **"Fetch Results"** again for the same week
3. System updates with new data

**It's safe to re-fetch!** The system will:
- Keep old results for participants
- Update with new data for anyone who uploaded since last fetch
- Replace old times if participant rode again (we pick the fastest)

## After Posting Results

### Announce the Winners!
Share the leaderboard link or screenshot with your community. Celebrate the winners!

**Example post:**
> Week 3 Results are in! 🏆
> 
> 1. Alice: 14:32 (5 points)
> 2. Bob: 15:08 (3 points)
> 3. Carol: 16:45 (1 point)
> 
> Great effort everyone! Leaderboard: [link]

### Season Standings
Check the **"Season"** tab on the leaderboard to see cumulative points. Share that too if you have multiple weeks done.

### Next Event
Create the next week and repeat the process!

## Troubleshooting

### No Results Found
**Problem:** System says "0 results found" when you expected some.

**Possible causes:**
1. **No participants connected yet** - Ask them to click "Connect with Strava" first
2. **Event window closed** - Make sure the time window was open when they rode
3. **Wrong segment** - Verify the segment ID is correct
4. **Time zone confusion** - Check if participants understood your timezone
5. **Activities haven't synced yet** - Strava can take 15-30 minutes to sync. Wait and re-fetch.

**Fix:** 
- Ask participants to confirm they rode and their activity is on Strava
- Verify segment ID is correct
- Try fetching again in 15 minutes (waits for Strava sync)

### Wrong Times Showing
**Problem:** Times on the leaderboard don't match Strava.

**Possible causes:**
1. **Calculation error** - We're summing segment effort times, which can differ slightly from activity total time
2. **Wrong segment selected** - Double-check the segment ID
3. **Partial reps counted** - Verify the activity has the full required reps

**Fix:**
- Refresh the page
- Check the week's segment ID
- Contact a technical lead if it persists

### Missing Participants
**Problem:** Someone rode but doesn't appear.

**Possible causes:**
1. **Not connected** - They haven't clicked "Connect" yet
2. **Activity is private** - Tell them to make it public/follower-visible
3. **Wrong segment** - They rode a different route
4. **Incomplete reps** - They only did 1 when 2 were required
5. **Outside time window** - They finished after the deadline

**Fix:**
- Check with the participant - did they actually complete it?
- Ask them to verify their activity is public on Strava
- Re-fetch after they connect or fix their activity

### System Error During Fetch
**Problem:** Fetch fails with an error message.

**Possible causes:**
1. **Strava API temporary issue** - Strava's servers might be down
2. **No connected participants** - At least one person needs to be connected for verification
3. **Bad segment ID** - Invalid segment on Strava

**Fix:**
- Try again in 5 minutes
- Verify the segment ID is correct
- Contact your technical lead if it keeps happening

## FAQ

**Q: Can participants see results before I post them?**
A: No, the leaderboard doesn't display results until you fetch them.

**Q: What if someone's activity appears after I fetch?**
A: Re-fetch! The system will add them and recalculate the leaderboard.

**Q: Can I edit results manually?**
A: Not yet, but it's on the roadmap. For now, re-fetch or contact a technical lead for manual overrides.

**Q: What if Strava is down?**
A: Wait 15-30 minutes for Strava to recover, then try again.

**Q: Can I fetch results for multiple weeks at once?**
A: No, do one week at a time. But it's fast (usually < 1 minute).

---

**Next:** [Manage Segments →](/admin/manage-segments)

Or go back to [Admin Setup →](/admin/setup)
