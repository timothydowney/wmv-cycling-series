# Create a Week

This guide walks you through creating a new weekly event.

## What You'll Need

- **Segment Name** (e.g., "Lookout Mountain")
- **Strava Segment ID** (the numeric ID from the Strava URL)
- **Event Date** (when you want the event to happen)
- **Required Reps** (how many times to complete the segment)
- **Optional:** Custom time window (defaults to midnight-10 PM)

## Finding the Strava Segment ID

1. Go to [Strava.com](https://strava.com)
2. Search for or navigate to the segment you want to use
3. Look at the URL: `https://www.strava.com/segments/SEGMENT_ID`
4. Copy the ID (a long number)

**Example:** If the URL is `https://www.strava.com/segments/23456789`, the ID is `23456789`.

## Step-by-Step: Create a Week

### 1. Go to Admin Panel
Log in with your admin account and click **"Manage Competition"** in the menu.

![Alt: Admin menu with Manage Competition highlighted]

### 2. Click "Create Week"
Look for the blue **"Create Week"** button.

![Alt: Create Week button]

### 3. Fill in the Details

**Week Name**
Something descriptive and fun:
- ✅ Good: "Week 3: Lookout Mountain Summit Challenge"
- ❌ Bad: "Week 3"

**Date**
Pick the date for the event. This sets the calendar date (used for the 12 AM - 10 PM default window).

**Strava Segment**
Paste the Strava segment ID (the number). The system will automatically look up the segment name, distance, and grade from Strava.

**Required Reps**
How many times participants must complete the segment in one activity:
- `1` = ride it once
- `2` = ride it twice (hill repeats)
- `5` = five repetitions
- Etc.

**Time Window (Optional)**
By default, the event runs from midnight to 10 PM on the event date.

If you want a custom window:
- **Start Time:** When the event opens (e.g., 6 AM for a sunrise challenge)
- **End Time:** When the event closes (e.g., 8 PM)

Leave blank to use defaults.

### 4. Review & Create
Double-check your details:
- [ ] Segment ID is correct
- [ ] Date is right
- [ ] Reps make sense for your athletes
- [ ] Time window is appropriate

Click **"Create"**.

### 5. Done!
The week is now created and visible on the website. The event now appears in the week selector.

## Example: Creating "Lookout Mountain Day"

| Field | Value |
|-------|-------|
| Week Name | Week 3: Lookout Mountain Double |
| Date | November 19, 2025 |
| Segment ID | 2345678 |
| Required Reps | 2 |
| Time Window | (use defaults: 12 AM - 10 PM) |

After creating, it appears on the leaderboard as "Week 3: Lookout Mountain Double" scheduled for Nov 19.

## Custom Time Windows Explained

The default time window (midnight to 10 PM) works for most events. But you can customize:

### Example 1: Sunrise Challenge
- **Start:** 6:00 AM (5 AM is too early, let people sleep)
- **End:** 9:00 AM (before work)
- **Reason:** Event runs only during sunrise hours

### Example 2: Lunch Ride
- **Start:** 11:00 AM
- **End:** 1:00 PM
- **Reason:** Quick ride during lunch break

### Example 3: Extended Window
- **Start:** 6:00 AM
- **End:** 10:00 PM
- **Reason:** Full day event, everyone can participate whenever they want

**Pro Tip:** Times are in UTC. If your athletes are in a different timezone, account for that when setting windows. Or stick with the default (midnight-10 PM), which usually works globally.

## After Creating the Week

### Next: Announce It!
Tell your community:
- **What:** Name and description of the segment
- **When:** Date and time window
- **How many reps:** 1? 2? 5?
- **Tips:** Conditions, traffic, elevation, etc.

**Example announcement:**
> Week 3: Lookout Mountain Double
> Date: Wednesday, November 19
> Time: Midnight to 10 PM UTC
> Challenge: Complete Lookout Mountain twice in one activity
> Tip: Start early to beat traffic!

### Day Before: Verify Participants
Check who's connected. Use **Participant Status** to see who's ready. Send reminders to anyone not yet connected.

### During Event: Monitor
You don't need to do anything. Just relax and let participants ride!

### After Event: Fetch Results
Once the time window closes, see [Fetch Results](/admin/fetch-results) to collect and post the leaderboard.

## Editing a Week

Already created a week but need to change it?

1. Go to **Manage Competition**
2. Find the week in the list
3. Click **"Edit"** or the week name
4. Update the details
5. Click **"Save"**

You can change:
- Week name
- Date
- Segment
- Required reps
- Time window

**Caveat:** Editing after results are posted will recalculate the leaderboard based on new criteria. Avoid editing unless necessary.

## Deleting a Week

If you create a week by mistake:

1. Go to **Manage Competition**
2. Find the week
3. Click **"Delete"**
4. Confirm

**Warning:** This deletes the week and all associated results. Be sure before confirming!

## Troubleshooting

**Q: Segment ID not found**
A: Double-check the URL from Strava. IDs are long numbers. Paste the exact number from the URL.

**Q: Week won't save**
A: Check that:
- You filled in all required fields
- The segment ID is valid
- The date is formatted correctly
- Required reps is a positive number

**Q: I see the week but no participants show up**
A: No participants are connected yet. Ask them to click "Connect" on the homepage. Then re-fetch results.

---

**Next:** [Fetch Results →](/admin/fetch-results)
