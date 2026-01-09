# About WMV Cycling Series

Learn the story behind the project and what it does.

## What is WMV Cycling Series?

WMV Cycling Series is a **community-driven cycling competition tracker** built for Western Mass Velo cycling club. It's designed to help organize weekly segment-based challenges, track performance, and build friendly competition within the club.

## The Vision

Create a simple, fair, and fun way for local cyclists to:
- Compete on meaningful segments
- Track improvement over a season
- Celebrate personal records and wins
- Build community through friendly rivalry

## How It Works

Every week:
1. **Admin picks a segment** (a popular climb or route)
2. **Participants ride it** during the event window
3. **System automatically collects results** from Strava
4. **Leaderboard updates instantly**
5. **Points accumulate** toward season championship

No manual submission. No complicated rules. Just ride your best and watch the leaderboard.

## Key Features

### 🚴 Automatic Activity Sync
Once you connect to Strava, your activities automatically sync during event windows. No manual uploading.

### 🏆 Fair Scoring
- Beat others → earn points
- Participate → bonus point
- Set a PR → bonus point
- Season total → overall winner

### 📊 Transparency
All leaderboards are public to club members. See how you rank, what times matter, and celebrate improvements.

### 🔒 Privacy-First
- Only one-click OAuth connection
- No passwords stored
- Data deletable on request (48-hour guarantee)
- GDPR and privacy-compliant

### 📱 Works Everywhere
No app to install. Just a website that works on phones, tablets, and computers.

## Understanding Scoring & Jerseys

### How Points Work

**Weekly Scoring:**
- **Beat competitors** → Earn points equal to how many riders you defeated
- **Participate** → +1 point for completing the event
- **Set a PR** → +1 bonus point if you achieve a personal record

Example: If 10 riders compete and you finish 3rd with a PR, you earn `(10-3) + 1 + 1 = 9 points`.

**Seasonal Scoring:**
Points accumulate across all weeks. The rider with the most total points at season's end wins the championship.

### The Jerseys

We celebrate the top performers with iconic cycling honors:

- 🟡 **Yellow Jersey**
  - **Season:** Held by the rider with the most total points overall.
  - **Weekly:** Awarded to the fastest rider on non-climb events.
- 🔴 **Polka Dot Jersey**
  - **Season:** Held by the rider with the most weekly hill climb wins.
  - **Weekly:** Awarded to the fastest rider on hill climb events.
- 🏮 **Lantern Rouge**
  - **Season:** Held by the rider with the lowest total points overall.
  - **Weekly:** Given to the last place finisher who completes the event.

These are honorary titles that celebrate different kinds of excellence—from pure speed to consistency.

WMV Cycling Series was created to solve a specific problem: how to organize fair, fun, and transparent cycling competitions for a community.

It's **open source**, meaning anyone can see how it works, contribute improvements, or adapt it for their own cycling club.

## The Team

Built and maintained by volunteers who love cycling and technology. See the [GitHub repository](https://github.com/timothydowney/wmv-cycling-series) for the full list of contributors.

## Roadmap: What's Coming Next

We have some exciting features in the works:

### 📲 Real-Time Webhooks (In Progress)
Instead of admins manually fetching results, Strava will automatically notify us when activities are completed. Leaderboards update instantly!

### 📧 Email Notifications (Coming Soon)
Get notifications when:
- A new event is created
- Results are posted
- You set a PR
- You're about to be beaten (friendly alert!)

### 🎨 Season Archival (Coming Soon)
Finish a season and archive it. Keep historical records, compare seasons, see how everyone improves year to year.

### 📱 Mobile App (Future)
A native mobile app for iOS and Android. Stay tuned!

### 📊 Advanced Analytics (Future)
Dive deeper into your data:
- Personal training trends
- Segment-specific improvements
- Head-to-head comparisons
- Predicted PRs based on fitness

## Privacy & Security

Your data matters. Here's what we do:

✅ **Encrypted Tokens** - Strava credentials are encrypted at rest
✅ **No Third-Party Sharing** - Your data is yours. Not sold, not shared
✅ **Deletion on Request** - Delete all your data anytime (within 48 hours)
✅ **GDPR Compliant** - Privacy-first architecture
✅ **Open Source** - Anyone can audit our code

See our [Privacy Policy](https://github.com/timothydowney/wmv-cycling-series/blob/main/PRIVACY_POLICY.md) for complete details.

## How to Get Involved

### Use It
Connect your Strava account and start competing! [Get Started →](/athlete/getting-started)

### Run Events
Are you an admin? Learn how to create weeks and manage competitions. [Admin Setup →](/admin/setup)

### Contribute
Found a bug? Have a feature idea? The code is open source on [GitHub](https://github.com/timothydowney/wmv-cycling-series).

### Spread the Word
Tell your cycling friends about WMV! More participants = more fun competition.

## Technology Behind It

WMV Cycling Series is built with modern, open-source tools:

- **Frontend:** React + TypeScript (responsive, fast)
- **Backend:** Node.js + Express (scalable, reliable)
- **Database:** SQLite (simple, no extra services needed)
- **Authentication:** Strava OAuth (secure, familiar)
- **Hosting:** Railway.app (fast deploys, automatic HTTPS)
- **Infrastructure:** GitHub + Docker (open, transparent)

All code is available on [GitHub](https://github.com/timothydowney/wmv-cycling-series) for anyone to review, fork, or contribute to.

## Why Strava?

Strava is the standard for cycling and running. It's where athletes track their data. By integrating with Strava, we avoid duplicating efforts and let participants use the tool they already love.

We respect Strava's platform and follow their [API terms](https://www.strava.com/legal/api) carefully.

## Questions?

### For Athletes
→ [Athlete FAQ](/athlete/faq)

### For Admins
→ [Admin Troubleshooting](/admin/troubleshooting)

### For Developers
→ [GitHub Repository](https://github.com/timothydowney/wmv-cycling-series)

### General
Ask your race organizer or contact the team on GitHub!

---

**Ready to join?** [Connect your Strava →](/athlete/connect-strava)

**Ready to organize?** [Setup your first event →](/admin/setup)
