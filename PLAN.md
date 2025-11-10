# Development Plan

This plan outlines the steps to build the Strava Competition Tracker application using React and TypeScript.

## Competition Rules & Scoring

### Weekly Competition Format
- **Frequency:** Weekly events (typically Tuesday)
- **Setup:** Administrator configures each week with:
  - Event date and time window
  - Strava segment ID (with description for participants)
  - Required number of repetitions
- **Participant Flow:**
  1. Participants connect to Strava **once** via OAuth (no weekly re-authentication)
  2. Participants perform their rides on the scheduled day
  3. **No manual submission required** - activities are fetched automatically
- **Activity Collection:**
  - **Current:** Admin triggers batch fetch at end of event day (clicks "Fetch Results" button)
  - **Future:** Event-based system using Strava webhooks (automatic)
  - System fetches all connected participants' activities from event day

### Scoring System
1. **Completion:** Participant must ride the designated segment the required number of times **within a single activity** on the correct day
2. **Best Attempt Counts:** If multiple qualifying activities exist on the same day, the **best single activity** is used
   - A qualifying activity contains the required number of segment repetitions
   - Non-qualifying activities (insufficient repetitions) are ignored
   - Activities spanning multiple segment efforts across different Strava activities do NOT count
   - Example: If 2 laps required, we need 2 segment efforts in ONE activity, not 1+1 from two separate rides
3. **Time Calculation:** Total time = sum of all segment efforts within the best qualifying activity
4. **Ranking:** Participants are sorted by total time (fastest to slowest)
5. **Base Points:** Each participant receives **1 point for every other participant they beat**
   - Example: If 4 participants complete the objective and you finish 2nd, you beat 2 people = 2 base points
   - First place beats everyone else, last place beats no one (0 base points)
6. **PR Bonus:** If a participant sets a Personal Record (PR) on any segment effort during the week's activity, they receive **+1 bonus point**
   - Determined from Strava API response (pr_rank field)
   - Applies even if you finish last in the competition
7. **Total Points:** Base points + PR bonus points
8. **Season Leaderboard:** Sum of total points across all weeks

### Data Requirements
- **Week Definition:** Segment ID, date, time window (midnight to 10pm default), required repetitions, description
- **Participant Registration:** One-time OAuth connection grants ongoing access
- **Activity Collection:** Admin-triggered batch fetch retrieves all participants' activities from event day
- **Activity Matching:**
  - Find all activities on the event day within time window
  - Filter to activities containing the required segment
  - Identify activities with required number of segment repetitions
  - Select the single best qualifying activity (fastest total time)
- **Validation:**
  - Activity date matches event day and time window
  - Activity contains required segment with sufficient repetitions
  - All segment efforts are within the same activity
  - Extract and sum segment effort times from best qualifying activity

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
    *   ✅ Comprehensive test suite (75 tests, 100% pass rate).
    *   ✅ Scoring updated: points = (participants beaten + 1 for competing) + PR bonus.
    *   ✅ Seasons support: Multiple seasons with historical records.
    *   ✅ Test isolation: Proper cleanup hooks for test independence.

7.  **Strava Integration - OAuth & Branding (✅ Complete):**
    
    **OAuth Backend:**
    *   ✅ Strava app registered (Client ID: 170916)
    *   ✅ Environment variables configured (.env file)
    *   ✅ `participant_tokens` table created for per-user token storage
    *   ✅ `GET /auth/strava` route (redirects to Strava authorization)
    *   ✅ `GET /auth/strava/callback` route (exchanges code for tokens, creates session)
    *   ✅ `GET /auth/status` route (returns connection status)
    *   ✅ `POST /auth/disconnect` route (revokes connection)
    *   ✅ `getValidAccessToken(participantId)` utility with proactive token refresh (1 hour before expiry)
    *   ✅ Session management with express-session (30-day cookies)
    
    **Strava Branding Assets:**
    *   ✅ Official "Connect with Strava" buttons (orange & white, 48px height)
    *   ✅ "Powered by Strava" attribution logo
    *   ✅ Brand compliance documentation (STRAVA_BRANDING.md)
    *   ✅ CSS utilities with Strava orange (#FC5200)
    
    **Frontend OAuth UI:**
    *   ✅ StravaConnect component with OAuth flow
    *   ✅ Shows "Connect with Strava" button when not authenticated
    *   ✅ Shows "Connected as [Name]" with disconnect when authenticated
    *   ✅ OAuth callback handling (success/error URL params)
    *   ✅ Loading and error states
    *   ✅ Integrated into App header
    *   ✅ "Powered by Strava" footer attribution
    
    **Testing:**
    *   ✅ All 84 backend tests passing
    *   ✅ Frontend builds successfully
    *   ⏳ Manual OAuth testing with real Strava account
    *   ⏳ Integration tests for OAuth endpoints
    
    **Documentation:** See `STRAVA_INTEGRATION.md` for complete implementation details, including:
    - Multi-user authorization workflow
    - Token refresh strategy (6-hour expiration)
    - Club activities API exploration
    - Security best practices
    - FAQ for participants

8.  **Activity Collection & Results (⏳ In Progress):**
    
    **Participant Registration:**
    *   ✅ OAuth connection flow (one-time setup per participant)
    *   ✅ Token storage and automatic refresh
    *   ✅ `GET /auth/status` - Check connection status
    *   ⏳ Participant UI showing connection status clearly
    *   ⏳ Admin dashboard to view all connected participants
    
    **Admin Batch Fetch System:**
    *   ⏳ `POST /admin/weeks/:id/fetch-results` - Fetch all participants' activities for a week
    *   ⏳ For each connected participant:
        - Fetch activities from event day (using time window)
        - Filter to activities containing required segment
        - Identify best qualifying activity (required reps + fastest time)
        - Store activity and segment efforts in database
    *   ⏳ Activity matching logic:
        - Multiple activities on same day → select best
        - Insufficient repetitions → skip activity
        - Re-fetch updates to best activity if already processed
    *   ⏳ Progress indicator/results summary after fetch
    *   ⏳ Automatic leaderboard recalculation after fetch
    
    **Admin Week Management:**
    *   ✅ `POST /admin/weeks` - Create week with segment ID
    *   ✅ `PUT /admin/weeks/:id` - Update week
    *   ✅ `DELETE /admin/weeks/:id` - Delete week
    *   ✅ Admin UI for creating/editing weeks with Event Date picker (auto-fills midnight-10pm times)
    *   ✅ Enhanced segment input with URL validation and visual feedback
    *   ✅ `GET /admin/segments` - List all known segments for autocomplete
    *   ✅ Segment URL parsing (strips query params, validates via Strava API)
    *   ✅ Autocomplete dropdown of previously used segments
    *   📋 Segment search/selection UI (future enhancement: smart single-box that auto-detects URLs vs names)
    
    **Future Automation:**
    *   📋 Event-based system using Strava webhooks
    *   📋 Auto-fetch when participants complete activities
    *   📋 Email notifications to participants
    *   📋 Cron job for Tuesday evening auto-fetch
    
    **Documentation:**
    *   ✅ `STRAVA_INTEGRATION.md` - OAuth and API integration
    *   ⏳ Update `ADMIN_GUIDE.md` with batch fetch workflow
    *   ⏳ Create `PARTICIPANT_GUIDE.md` for users

9.  **Production Deployment (⏳ After Activity Collection):**
    *   ⏳ Set up Railway.app hosting
    *   ⏳ Configure environment variables
    *   ⏳ Set up persistent session store (Redis or database-backed sessions)
    *   ⏳ Configure production domain and HTTPS
    *   ⏳ Update Strava OAuth redirect URIs for production
    *   ⏳ Set up database backup strategy
    *   ⏳ GitHub Actions CI/CD pipeline (see workflow section below)
    *   ⏳ Manual testing with real Strava accounts in production

9.  **Production Deployment (⏳ Next):**
    *   ⏳ Set up Railway.app hosting
    *   ⏳ Configure environment variables
    *   ⏳ Set up persistent session store (Redis or database-backed sessions)
    *   ⏳ Configure production domain and HTTPS
    *   ⏳ Update Strava OAuth redirect URIs for production
    *   ⏳ Set up database backup strategy
    *   ⏳ GitHub Actions CI/CD pipeline (see workflow section below)
    *   ⏳ Manual testing with real Strava accounts in production

10. **Admin UI Tools (Future):**
    *   ⏳ Week creation form (segment ID, date, time window, repetitions, description)
    *   ⏳ Segment ID validation and preview
    *   ⏳ "Fetch Results" button on week detail page
    *   ⏳ Participant connection status dashboard
    *   ⏳ Week management (edit, delete, duplicate)
    *   📋 Segment search/selection UI (search Strava for segments)
    *   📋 Participant management (add, remove, view history)
    *   📋 Activity review/audit log (see what was fetched)
    *   📋 Manual override (exclude activities, adjust points)
    *   📋 Export/import functionality for backup

11. **Auto-Detection & Enhancements (Future):**
    *   📋 Strava webhook integration (activity.create events)
    *   📋 Real-time activity processing as participants complete rides
    *   📋 Cron job fallback for Tuesday evening batch processing
    *   📋 Email notifications to participants (results posted, standings)
    *   📋 Mobile-responsive design improvements
    *   📋 Activity submission history per participant
    *   📋 Personal stats dashboard for participants

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

## Deployment Workflow (GitHub Actions + Railway)

### CI/CD Pipeline Strategy

**Continuous Integration (CI) - On every push/PR:**
- Run backend tests (`npm test`)
- Build frontend (`npm run build`)
- Lint code
- Verify Node version compatibility

**Continuous Deployment (CD) - On merge to `main`:**
- Railway auto-deploys from `main` branch
- Zero-downtime deployment

### GitHub Actions CI Workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20, 24]
    
    steps:
    - uses: actions/checkout@v3
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
    - run: npm install
    - run: npm test
    - run: npm run build
    - run: npm run lint
```

### Railway Deployment

Railway integrates directly with GitHub:
1. Connect repo to Railway
2. Railway watches `main` branch
3. On merge → Railway auto-deploys
4. Configure in Railway dashboard

### Development Workflow

```
feature branch → PR → CI tests → merge to main → Railway deploys
```

---

### Next Steps for Deployment

1. ✅ Finish OAuth implementation locally
2. ✅ Test thoroughly with real Strava accounts
3. **Set up GitHub Actions CI** (create `.github/workflows/ci.yml`)
4. Create Railway account, connect GitHub repo
5. Set environment variables in Railway dashboard
6. Railway auto-deploys from `main`
7. Test production OAuth flow
8. Update DNS if using custom domain (optional)
9. Set up weekly database backups
10. Configure branch protection (require CI to pass before merge)
11. Announce to Western Mass Velo club!

