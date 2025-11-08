# Development Plan

This plan outlines the steps to build the Strava Competition Tracker application using React and TypeScript.

## Competition Rules & Scoring

### Weekly Competition Format
- **Frequency:** Every Tuesday
- **Objective:** Each week defines a specific Strava segment and required number of laps
- **Completion Requirement:** Participants must complete the objective on the designated Tuesday
- **Activity Tracking:** Each participant submits their Strava activity URL for validation

### Scoring System
1. **Completion:** Participant must ride the designated segment the required number of times within a single activity on the correct Tuesday
2. **Time Calculation:** Total time = sum of all segment efforts for that activity (e.g., if 2 laps required, sum both lap times)
3. **Ranking:** Participants are sorted by total time (fastest to slowest)
4. **Base Points:** Each participant receives **1 point for every other participant they beat**
   - Example: If 4 participants complete the objective and you finish 2nd, you beat 2 people = 2 base points
   - First place beats everyone else, last place beats no one (0 base points)
5. **PR Bonus:** If a participant sets a Personal Record (PR) on any segment effort during the week's activity, they receive **+1 bonus point**
   - Determined from Strava API response (pr_rank field)
   - Applies even if you finish last in the competition
6. **Total Points:** Base points + PR bonus points
7. **Season Leaderboard:** Sum of total points across all weeks

### Data Requirements
- **Week Definition:** Segment ID, date (Tuesday), number of required laps
- **Activity Submission:** Strava activity URL from each participant
- **Validation:**
  - Activity date matches week's Tuesday
  - Activity contains the required segment
  - Segment was completed the required number of times
  - Extract and sum segment effort times

## Credential Management

For local development, Strava API credentials (Client ID and Client Secret) are stored in `public/strava-credentials.json`. This file is included in `.gitignore` to prevent it from being committed to the repository. In a production environment, these credentials should be managed through environment variables or a secure secret management system.

## Milestones

1.  **Project Initialization (✅ Complete):**
    *   Clean up the old plain HTML/JS project.
    *   Initialize a new React + TypeScript project using Vite.
    *   Create a `README.md` and this `PLAN.md`.

2.  **Component Scaffolding and Data Migration (✅ Complete):**
    *   Install `strava-api-client`.
    *   Move the `data` directory to the `public` folder.
    *   Create the component file structure.
    *   Define data types/interfaces for our models.

3.  **Local Data Implementation (✅ Complete):**
    *   Refactor the application to lift state to the `App` component.
    *   Implement "dumb" components for rendering leaderboards and selectors.

4.  **Backend API (✅ Complete):**
    *   Set up Node 20-24 environment.
    *   Create Express + SQLite backend in `server/`.
    *   Implement database schema (participants, segments, weeks, activities, segment_efforts, results).
    *   Auto-seed from existing JSON files.
    *   Create REST endpoints: `/participants`, `/segments`, `/weeks`, `/weeks/:id/leaderboard`, `/season/leaderboard`.
    *   Update README with backend setup instructions.
    *   Add comprehensive test suite (94% coverage, 59 test cases).

5.  **Refined Data Model & Scoring (✅ Complete):**
    *   ✅ Update schema to track Strava activity URLs per participant per week.
    *   ✅ Revise results table to store individual segment efforts.
    *   ✅ Implement correct scoring: points = number of participants beaten + PR bonus.
    *   ✅ Add validation for activity date (time window: midnight-10pm on event day).
    *   ✅ Support multi-lap activities: extract and sum segment efforts from single activity.
    *   ✅ Admin endpoints for week management (POST/PUT/DELETE /admin/weeks).

6.  **Development Infrastructure (✅ Complete):**
    *   ✅ Configure CORS for local development.
    *   ✅ Add nodemon for backend auto-reload.
    *   ✅ Vite HMR already configured for frontend.
    *   ✅ Single command setup: `npm run dev:all`.
    *   ✅ Comprehensive documentation (README, ADMIN_GUIDE, DATABASE_DESIGN, STRAVA_INTEGRATION).
    *   ✅ Copilot instructions for future development.
    *   ✅ Initial git commit with clean repository.

7.  **Strava Integration - OAuth & Activity Validation (🔜 Next):**
    
    **Multi-User OAuth Setup:**
    *   ✅ Strava app already registered (Client ID: 170916)
    *   Add environment variables (`STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REDIRECT_URI`)
    *   Create `participant_tokens` table for per-user token storage
    *   Implement `GET /auth/strava` route (redirect to Strava authorization)
    *   Implement `GET /auth/strava/callback` route (exchange code for tokens)
    *   Build `getValidAccessToken(participantId)` utility with token refresh logic
    *   Add session management to track logged-in participants
    *   Frontend: "Connect with Strava" button + connection status indicator
    
    **Activity Submission & Validation:**
    *   Create `POST /weeks/:id/submit-activity` endpoint (accepts Strava URL)
    *   Extract activity ID from URL pattern `strava.com/activities/12345`
    *   Fetch activity details via Strava API using participant's access token
    *   Validate activity date matches week's Tuesday time window
    *   Extract segment efforts for the designated `strava_segment_id`
    *   Validate participant completed required number of laps
    *   Calculate total time (sum of effort times)
    *   Store validated activity in `activities`, `segment_efforts`, and `results` tables
    *   Recalculate leaderboard and update scores
    
    **Testing:**
    *   Test OAuth flow with personal Strava account
    *   Submit real Strava activity URLs from test rides
    *   Verify token refresh works automatically
    *   Confirm leaderboard updates correctly
    
    **Documentation:** See `STRAVA_INTEGRATION.md` for complete implementation details, including:
    - Multi-user authorization workflow
    - Token refresh strategy (6-hour expiration)
    - Club activities API exploration
    - Security best practices
    - FAQ for participants



8.  **Frontend - Activity Submission & Display:**
    *   Wire frontend to backend API endpoints (partially done - read-only).
    *   Add "Connect with Strava" OAuth flow.
    *   Create UI for participants to submit Strava activity URLs.
    *   Display validation status and errors.
    *   Show connection status for each participant.
    *   Real-time leaderboard updates after submissions.

9.  **Admin UI Tools:**
    *   Create forms for adding/editing participants.
    *   Create forms for adding/editing segments.
    *   Create form to set up new week (segment, date, laps, time window).
    *   Allow admin to manually validate/reject submissions.
    *   Export/import functionality for backup.

10. **Production Deployment (Future):**
    *   Configure production database.
    *   Set up environment variables.
    *   Build and deploy frontend.
    *   Deploy backend API.
    *   Set up SSL/HTTPS.
    *   Configure production Strava OAuth callback URLs.

---

## Hosting & Deployment Considerations

### Requirements Analysis

**Frontend (React + Vite):**
- Static files only (HTML, CSS, JS)
- No server-side rendering needed
- Can be served from CDN
- ~2-5 MB total bundle size

**Backend (Node.js + Express):**
- Needs persistent Node.js runtime
- SQLite database (file-based, grows with data)
- API endpoints must be always available
- Minimal compute requirements (~100 MB RAM)
- Needs environment variables for Strava secrets

**Database (SQLite):**
- File-based, no separate DB server needed
- Requires persistent storage (not ephemeral)
- ~5-50 MB depending on activity data
- Needs regular backups

### Hosting Options Comparison

#### ❌ **GitHub Pages** - NOT Suitable
**Why it won't work:**
- Static hosting only (no Node.js runtime)
- Can't run Express backend
- Can't host SQLite database
- Frontend only - would need separate backend host

**Verdict:** Cannot use for this project due to backend requirements.

---

#### ✅ **Railway.app** - RECOMMENDED (Perfect for <100 participants)
**Pros:**
- Simple deployment from GitHub
- Node.js runtime included
- Persistent volume for SQLite database
- Free tier: $5 monthly credit (enough for small apps)
- Automatic HTTPS
- Environment variables management
- One platform for both frontend & backend
- **Ideal for <100 participants - no need to scale beyond this**

**Cons:**
- Paid after free credit runs out (~$5-10/month)

**Cost:** FREE for small usage, then ~$5-10/month

**Setup Steps:**
1. Push code to GitHub
2. Connect Railway to repo
3. Set environment variables (Strava secrets)
4. Deploy - gets automatic URL like `your-app.railway.app`
5. Update Strava OAuth callback to production URL

**Best for:** Western Mass Velo - perfect fit, simple, no over-engineering needed

---

#### ✅ **Render.com** - Alternative (More features than you need)
**Pros:**
- Free tier available (with limitations)
- Static site hosting + web services
- Persistent disks for SQLite
- Auto-deploy from GitHub
- Automatic HTTPS

**Cons:**
- Free tier spins down after 15 min inactivity (slow cold starts)
- Paid tier needed for always-on (~$7/month)
- More complex than needed for <100 participants

**Cost:** FREE (with slowness) or $7/month

**Best for:** If you want free tier with occasional use (but Railway is simpler)

---

#### ✅ **Fly.io** - Over-engineered for your needs
**Pros:**
- Global edge deployment (unnecessary for local cycling club)
- Persistent volumes for SQLite
- Free tier: 3GB storage, 160GB transfer
- Fast deploys

**Cons:**
- More complex configuration
- CLI-based deployment
- Features you won't use (multi-region, edge computing)

**Cost:** FREE for small apps, scales up as needed

**Best for:** Learning experience only - Railway is better fit for <100 participants

---

#### ⚠️ **Vercel / Netlify** - Partial Solution
**Pros:**
- Excellent for frontend (React app)
- Free tier, automatic CDN
- Great DX, fast deploys

**Cons:**
- **Serverless functions only** (not full Express app)
- SQLite doesn't work (no persistent filesystem in functions)
- Would need to:
  - Host frontend here
  - Host backend elsewhere (Railway/Render)
  - Use PostgreSQL instead of SQLite

**Verdict:** Good for frontend, but backend needs separate host

---

#### 🔧 **AWS (EC2 + S3)** - Massive overkill for <100 participants
**Pros:**
- Full control over everything
- Can run SQLite on EC2
- Cheap t3.micro instance (~$3-5/month)

**Cons:**
- **Way too complex for a small cycling club**
- Manage server updates, security, SSL
- Need nginx/reverse proxy setup
- SSH access, security groups, etc.
- Hours of DevOps work for features you don't need

**Cost:** ~$5-10/month + many hours of setup/maintenance

**Best for:** If you want a DevOps learning project (not recommended for actual use)

---

#### 🔧 **DigitalOcean Droplet** - Also overkill
**Pros:**
- Simple VPS, easy to understand
- $4-6/month for small droplet

**Cons:**
- Manual server setup (nginx, PM2, SSL)
- Maintenance overhead
- Need to handle security updates
- **Railway does all this automatically - why do it manually?**

**Cost:** ~$4-6/month + your time

**Best for:** Only if you really want to learn server administration

---

### Recommended Deployment Strategy

**For Western Mass Velo (<100 participants):**

**Single Platform Deployment - Railway.app**
- Deploy backend with SQLite on persistent volume
- Railway serves the built frontend static files
- Total cost: $0-5/month (within free tier)
- **SQLite easily handles <100 participants** (can handle thousands)
- Weekly competitions = minimal database load
- Simple architecture = less to break

**Why This Is Perfect:**
- **No scaling needed:** 100 participants * 52 weeks = 5,200 activities/year (tiny dataset)
- **No performance issues:** SQLite can handle millions of rows, you'll have thousands
- **No complexity:** One platform, one database file, one deployment
- **Low maintenance:** Set it up once, it just works
- **Cheap:** Likely stays in free tier forever

**You DON'T Need:**
- PostgreSQL or managed database (SQLite is perfect for this scale)
- Multiple hosting platforms (Railway does everything)
- Load balancing or CDN (traffic will be minimal - weekly check-ins)
- Caching layer (responses are fast enough)
- Monitoring beyond Railway's built-in logs (simple app, easy to debug)

---

### Database Backup Strategy

**Critical:** SQLite file must be backed up regularly!

**Options:**
1. **Manual backups** via SFTP/scp weekly
2. **Automated cron job** to copy DB to cloud storage (S3, Droplet Spaces)
3. **Git-based backups** (NOT recommended - binary files in git)
4. **Platform snapshots** (Railway/Fly.io provide volume snapshots)

**Recommended:** Weekly automated backup to cloud storage bucket

---

### Environment Variables for Production

These must be set on hosting platform:

```bash
NODE_ENV=production
PORT=3001
CLIENT_BASE_URL=https://yourdomain.com
STRAVA_CLIENT_ID=170916
STRAVA_CLIENT_SECRET=8b6e881a410ba3f4313c85b88796d982f38a59a9
STRAVA_REDIRECT_URI=https://yourdomain.com/auth/strava/callback
DATABASE_PATH=/data/wmv.db
SESSION_SECRET=<generate-random-string>
```

**Also update on Strava:**
- Go to https://www.strava.com/settings/api
- Update "Authorization Callback Domain" to your production domain

---

### Next Steps for Deployment

1. ✅ Finish OAuth implementation locally
2. ✅ Test thoroughly with real Strava accounts
3. Choose hosting platform (recommend Railway.app)
4. Create account, connect GitHub repo
5. Set environment variables in platform dashboard
6. Deploy and test production OAuth flow
7. Update DNS if using custom domain (optional)
8. Set up weekly database backups
9. Announce to Western Mass Velo club!

