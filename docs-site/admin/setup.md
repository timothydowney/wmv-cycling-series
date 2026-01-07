# Admin Setup Guide

Welcome, admin! This guide walks you through everything you need to set up and run WMV Cycling Series events.

## Before You Start

Make sure you have:
- ✅ Admin access to the WMV Cycling Series platform
- ✅ A Strava account (to verify segments exist)
- ✅ At least one participant connected to their Strava account
- ✅ A list of segment IDs for events you want to create

**Don't have admin access?** Contact your organization's technical lead or the app owner.

## Admin Access & Permissions

Admin access is based on your **Strava athlete ID**. Only designated admins can:
- Create and edit weekly events
- Fetch results after events
- Manage segments
- View participant connection status

If you think you should have access, ask your organization lead to add your athlete ID to the admin list.

## Finding Your Strava Athlete ID

You'll need this for configuration. Here's how to find it:

1. Log in to [Strava.com](https://strava.com)
2. Go to your profile (click your name in the top right)
3. Look at the URL in your browser: `https://www.strava.com/athletes/YOUR_ID_HERE`
4. Your ID is the number at the end

**Example:** If your profile URL is `https://www.strava.com/athletes/12345678`, your athlete ID is `12345678`.

## Your Admin Dashboard

Once logged in with admin access, you'll see additional menu items:

- **Manage Competition** - Create and edit weeks
- **Manage Segments** - Verify and cache segment data
- **Participant Status** - See who's connected and ready to ride

### Manage Competition
Create new events, update schedules, and view results.

### Manage Segments
Add Strava segments to your database. This validates they exist and caches information like segment name, distance, and average grade.

### Participant Status
See all participants who have connected their Strava accounts. Know exactly who's ready for the next event.

## Common Admin Tasks

### 1. Set Up Your First Week
See [Create a Week](/admin/create-week)

### 2. Verify Participants Are Connected
Go to **Participant Status** to confirm who's ready. Send a reminder to anyone who hasn't connected yet.

### 3. Announce the Event
Tell your community:
- Which segment they'll be riding
- The date and time window
- How many reps are required
- Any special instructions

### 4. Collect Results
After the event window closes, see [Fetch Results](/admin/fetch-results)

### 5. Announce Winners
Share the leaderboard! It's automatically available on the website.

## Important Concepts

### Segments
A **segment** is a defined route on Strava (usually a hill, steep section, or scenic climb). You specify the Strava segment ID, and participants ride it.

**Finding Strava Segment IDs:**
1. Go to a segment on Strava
2. Look at the URL: `https://www.strava.com/segments/SEGMENT_ID`
3. Copy the number

### Time Windows
Each event has a **start time** and **end time**. Activities must be completed within this window to count.

**Default:** Midnight to 10 PM on event day (adjustable per event)
**Why?** Gives participants a full day, but closes the results window for fair scoring

### Required Reps
**Reps** = how many times participants must complete the segment in one activity.

**Examples:**
- 1 rep = ride it once
- 2 reps = ride it twice in the same activity
- 5 reps = ride it five times (hill repeats)

**Important:** Multiple rides on different days don't combine. All reps must be in one activity.

## Pre-Event Checklist

- [ ] Segment exists on Strava
- [ ] Time window is set correctly
- [ ] Required reps are reasonable for your participants
- [ ] At least one participant is connected
- [ ] Announcement sent to community with date/time/details

## Post-Event Checklist

- [ ] Event window has closed
- [ ] Results have been fetched
- [ ] Leaderboard looks correct
- [ ] No data errors or missing participants
- [ ] Winners announced (optional but fun!)

## Next Steps

- [Create Your First Week →](/admin/create-week)
- [Learn About Fetching Results →](/admin/fetch-results)
- [Manage Segments →](/admin/manage-segments)

---

**Questions?** See [Admin Troubleshooting →](/admin/troubleshooting)
