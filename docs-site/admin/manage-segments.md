# Manage Segments

Segments are the routes your participants will ride. This guide explains how to manage them.

## What's a Segment?

A **segment** is a defined route on Strava—usually a hill, climb, or scenic stretch of road. It has:
- A name ("Lookout Mountain", "Main Street Hill", etc.)
- A distance (e.g., 2.5 miles)
- An average grade (steepness: 6.5%)
- A location (city, state)

When you create an event, you specify a segment. Participants then ride that segment and compete for the best time.

## Where Do Segments Come From?

Segments are created by the Strava community. If a popular route doesn't have a segment yet, users can create one on Strava. Then you can use it in WMV events.

**You don't create segments—Strava does.** You just reference them by ID.

## Finding Segment IDs

To use a segment in an event, you need its **Strava segment ID**.

### Method 1: From Strava Website
1. Go to [Strava.com](https://strava.com)
2. Search for the segment (e.g., "Lookout Mountain")
3. Look at the URL: `https://www.strava.com/segments/SEGMENT_ID`
4. Copy the number

**Example:** 
- URL: `https://www.strava.com/segments/23456789`
- ID: `23456789`

### Method 2: From a Participant's Activity
1. Ask a participant to share an activity with that segment
2. Click on the segment within their activity
3. Get the ID from the URL

### Method 3: Search in Segment Manager
If a segment is already in your system, search the manager to find its ID.

## Managing Segments (Admin Panel)

Go to **"Manage Segments"** to view, search, and add segments.

### View Segments
You'll see a list of all segments you've used. For each, you can see:
- **Name** - Official Strava name
- **Distance** - Length of the segment
- **Grade** - Average steepness (%)
- **Location** - City, state, country
- **Last Used** - When this segment was used in an event

### Add a New Segment

1. Click **"Add Segment"**
2. Paste the **Strava Segment ID** (just the number)
3. Click **"Validate"**

The system will:
- Look up the segment on Strava
- Fetch its metadata (name, distance, grade, location)
- Save it to your database

If valid, it's now available for creating events.

### Search Segments
Use the search box to find a segment:
- By name ("Lookout Mountain")
- By ID ("23456789")
- By location ("Colorado", "Denver")

### Update Segment Data
Click **"Refresh"** to update a segment's metadata (in case Strava made changes).

Or click **"Refresh All"** to update every segment at once.

## Why Cache Segments?

The app stores (caches) segment information for two reasons:

1. **Performance** - Segments load instantly when creating events (no API calls)
2. **Reliability** - If Strava is temporarily down, your segments still work

Cached data is refreshed periodically to stay current.

## Choosing Good Segments

When planning your event schedule, pick segments that:

### ✅ Good Choices
- **Popular on Strava** - Many athletes know them
- **Challenging but doable** - Appropriate for your skill level
- **Varied** - Different segments keep things fresh
- **Local** - Routes your community rides regularly
- **Have good metadata** - Name, distance, and grade are clear

### ❌ Avoid
- **Too short** - Segments that are <0.5 miles are easy to abandon
- **Too long** - Segments >5 miles may be exhausting for weekly events
- **Obscure** - Segments with 0 leaderboard activity
- **Dangerous** - Heavy traffic, poor conditions, unsafe descents
- **Extremely steep** - 15%+ grades exclude many riders

## Segment Verification

When you add a segment, the system verifies it exists on Strava.

### Verification Requires
At least one participant connected to their Strava account (so the system can look it up).

**If verification fails:**
- Segment doesn't exist on Strava
- Segment ID is incorrect
- Strava API is temporarily down

Try again or double-check the ID.

## Pro Tips

### Seasonal Planning
Plan your whole season's segments in advance:
- Create all segments before the season starts
- Ensures variety and prevents duplicates
- Lets participants prepare and train

### Segment Rotation
Keep things interesting by rotating segments:
- Week 1: Lookout Mountain (climbing)
- Week 2: Valley Loop (distance)
- Week 3: Main Street (speed)
- Week 4: State Park (scenic)

### Local Favorites
Stick with segments your community knows. Familiar routes feel competitive.

### Difficulty Curve
Mix easy, medium, and hard:
- Make early weeks doable
- Ramp up difficulty mid-season
- Finals can be the hardest

## FAQ

**Q: Can I delete a segment?**
A: Not from the manager (it's in your history). You can stop using it in new events.

**Q: What if a segment disappears on Strava?**
A: Your cached data stays. The event still works, but Strava won't recognize new attempts. Avoid deleted segments.

**Q: Can I use the same segment twice?**
A: Yes! Riding the same segment multiple weeks is fine. Just keep it interesting with different rep requirements.

**Q: How do I know if a segment is good for a race?**
A: Check Strava:
- Look at leaderboards - is it popular?
- Check if community standards exist
- Read recent activity comments - is it safe?
- Verify weather/conditions are typical

**Q: Can I suggest new segments?**
A: Ask your community to create them on Strava first. Then add them to WMV.

---

**Next:** [Troubleshooting →](/admin/troubleshooting)

Or go back to [Fetch Results →](/admin/fetch-results)
