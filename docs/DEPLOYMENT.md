# Deployment Guide

Complete information for deploying WMV Cycling Series to production.

## Requirements Analysis

### Frontend (React + Vite)
- Static files only (HTML, CSS, JS)
- No server-side rendering needed
- Can be served from CDN
- ~2-5 MB total bundle size

### Backend (Node.js + Express)
- Needs persistent Node.js runtime
- SQLite database (file-based, grows with data)
- API endpoints must be always available
- Minimal compute requirements (~100 MB RAM)
- Needs environment variables for Strava secrets

### Database (SQLite)
- File-based, no separate DB server needed
- Requires persistent storage (not ephemeral)
- ~5-50 MB depending on activity data
- Needs regular backups

---

## Hosting Options Comparison

### ✅ **Railway.app** - RECOMMENDED (Perfect for <100 participants)

**Why it's the best choice for Western Mass Velo:**
- Simple deployment from GitHub
- Node.js runtime included
- Persistent volume for SQLite database
- Free tier: $5 monthly credit (enough for this project)
- Automatic HTTPS
- Environment variables management
- One platform for both frontend & backend
- **Ideal for <100 participants - no scaling needed**

**Pros:**
- Deploy directly from GitHub repo (one click)
- Automatic builds and deployments on push
- Persistent storage for SQLite database
- Built-in PostgreSQL if you ever need it (you don't yet)
- Free tier covers small hobby projects
- Great developer experience (just push code)

**Cons:**
- Paid after free credit runs out (~$5-10/month)
- Not suitable for massive scale (but WMV will never need it)

**Cost:** FREE within free tier (~$5/month once you exceed it)

**Setup Steps:**
1. Push code to GitHub (already done)
2. Create Railway account
3. Connect Railway to GitHub repo
4. Set environment variables (`STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, etc.)
5. Railway auto-deploys on push to main branch
6. Gets automatic URL like `your-app.railway.app`
7. Update Strava OAuth callback to production URL

**Perfect for:** This project - simple, no over-engineering needed

---

### Alternative Options

#### ⚠️ **Render.com** - More features than you need

**Pros:**
- Free tier available
- Static site + web services
- Persistent disks for SQLite
- Auto-deploy from GitHub
- Automatic HTTPS

**Cons:**
- Free tier spins down after 15 min inactivity (slow cold starts)
- Paid tier needed for always-on (~$7/month)
- More complex than you need

**Cost:** FREE (with performance penalty) or $7/month

**Verdict:** Use Railway instead—simpler

---

#### ⚠️ **Fly.io** - Overengineered for your scale

**Pros:**
- Global edge deployment
- Persistent volumes for SQLite
- Free tier: 3GB storage, 160GB transfer
- Fast deploys

**Cons:**
- More complex CLI-based setup
- Features you won't need (multi-region, edge computing)
- Unnecessary complexity for <100 participants

**Cost:** FREE for small apps, scales up

**Verdict:** Use Railway instead—it's simpler

---

#### ❌ **Vercel / Netlify** - Unsuitable

**Why it won't work:**
- Static hosting only (no Node.js runtime)
- Serverless functions don't support persistent SQLite
- No persistent filesystem in functions
- Would need separate backend host + PostgreSQL

**What you'd need:**
- Host frontend here
- Host backend elsewhere (Railway/Render)
- Use PostgreSQL instead of SQLite
- Massive over-complication

**Verdict:** NOT recommended for this architecture

---

#### ❌ **AWS (EC2)** - Massive overkill

**Why it's wrong for WMV:**
- **Way too complex** for a small cycling club
- Manage server updates, security, SSL yourself
- Need nginx/reverse proxy setup
- SSH access, security groups configuration
- Hours of DevOps work for features you don't need
- t3.micro costs ~$3-5/month but needs manual setup

**When to consider:** If you want a DevOps learning project (not for actual use)

**Verdict:** NOT recommended - use Railway

---

#### ❌ **DigitalOcean Droplet** - Also overkill

**Why it's wrong:**
- Manual server setup (nginx, PM2, SSL)
- Maintenance overhead
- Need to handle security updates
- Railway does all this automatically

**Cost:** ~$4-6/month + many hours of setup/maintenance

**Verdict:** NOT recommended - Railway is simpler

---

## Recommended: Railway.app Single Platform Deployment

### Why This is Perfect for WMV

**Single Platform for Everything:**
- Deploy backend with SQLite on persistent volume
- Railway serves the built frontend static files
- Total cost: $0-5/month (likely stays in free tier)

**SQLite is Perfect at This Scale:**
- 100 participants × 52 weeks = 5,200 activities/year
- Tiny dataset (thousands of rows, not millions)
- SQLite can handle millions of rows—you'll have thousands
- No need for PostgreSQL or managed database
- No additional database service to pay for or maintain

**Architecture is Simple:**
- One platform, one database file, one deployment
- Less to break, easier to debug
- Minimal maintenance overhead

**You DON'T Need:**
- PostgreSQL or managed database (SQLite is perfect)
- Multiple hosting platforms
- Load balancing or CDN (minimal traffic)
- Caching layers (responses are fast enough)
- Complex monitoring (app is simple)

---

## Environment Variables for Production

Set these on Railway dashboard:

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

**Generate SESSION_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Also update on Strava:**
- Go to https://www.strava.com/settings/api
- Update "Authorization Callback Domain" to your production domain
- Update redirect URIs to use https://yourdomain.com

---

## Database Backup Strategy

**Critical:** SQLite file must be backed up regularly!

### Options

#### 1. Manual Backups via SFTP/SCP
- Weekly backup to your local machine
- Simple but requires manual action

#### 2. Automated Cron Job to Cloud Storage
- Script copies DB to S3, Azure Blob, etc.
- Runs on a schedule (e.g., daily)
- Cost: Minimal (S3 is cheap)

#### 3. Platform Snapshots (Railway)
- Railway provides volume snapshots
- Can restore quickly if needed
- Check Railway dashboard for snapshot settings

**Recommended:** Automated backup to cloud storage bucket
- Set cron job to run daily at 2 AM UTC
- Copy DB to S3 bucket
- Costs ~$1/month
- Can restore from any point in time

### Simple Backup Script

```bash
#!/bin/bash
# backup-db.sh - Run via cron job

DB_FILE="/data/wmv.db"
BACKUP_TIME=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/tmp/wmv_backup_${BACKUP_TIME}.db"

# Copy database
cp $DB_FILE $BACKUP_FILE

# Upload to S3 (requires AWS CLI)
aws s3 cp $BACKUP_FILE s3://your-bucket/wmv-backups/

# Clean up local temp
rm $BACKUP_FILE

# Keep only last 30 days on S3
aws s3 rm s3://your-bucket/wmv-backups/ \
  --older-than 30
```

---

## Deployment Workflow with GitHub Actions

### CI/CD Pipeline Strategy

**Continuous Integration (on every push/PR):**
- Run backend tests
- Build frontend
- Lint code
- Verify Node version compatibility

**Continuous Deployment (on merge to main):**
- Railway auto-deploys from main branch
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
        node-version: [24]
    
    steps:
    - uses: actions/checkout@v3
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
    - run: npm install
    - run: npm test
    - run: npm run build
```

### Railway Deployment

Railway integrates directly with GitHub:

1. Create Railway account
2. Connect repo to Railway
3. Railway watches `main` branch
4. On merge → Railway auto-deploys
5. Configure in Railway dashboard

### Development Workflow

```
feature branch → PR → CI tests → merge to main → Railway deploys
```

---

## Production Checklist

### Before Going Live

- [ ] Strava app configured with production domain
- [ ] Environment variables set on Railway
- [ ] Database backup strategy implemented
- [ ] GitHub Actions CI workflow created
- [ ] Branch protection: require CI to pass before merge
- [ ] HTTPS working (automatic on Railway)
- [ ] Test OAuth flow with production credentials
- [ ] Test activity fetching with real Strava data
- [ ] Database backup tested (can restore)
- [ ] Monitoring set up (at minimum: error logs)

### Going Live

1. Verify all checklist items complete
2. Announce to Western Mass Velo
3. Provide simple instructions: "Visit [URL] → Click Connect → Done!"
4. Monitor for first week
5. Be ready to rollback if needed (just redeploy previous commit)

### Post-Launch

- [ ] Daily check: Are servers running?
- [ ] Weekly: Check for error logs
- [ ] Weekly: Run database backup
- [ ] Monthly: Review participant feedback
- [ ] Monthly: Check Railway usage/costs
- [ ] As needed: Deploy updates (just push to main)

---

## Custom Domain Setup (Optional)

### If You Want a Custom Domain

**Instead of:** `your-app.railway.app`
**You could have:** `wmv-cycling.com` or similar

#### Steps:

1. Register domain (GoDaddy, Namecheap, etc.)
2. On Railway dashboard:
   - Go to project settings
   - Add custom domain
   - Follow DNS setup instructions
3. Configure Strava OAuth with custom domain
4. Update `CLIENT_BASE_URL` environment variable

**Cost:** Domain registration only (~$10/year)
**Benefit:** Professional look, easier to remember

---

## Scaling (Future Reference)

**When to consider scaling:**
- >1000 participants
- Multiple seasons running simultaneously
- Weekly traffic >10,000 requests

**For now:** This architecture handles <100 participants indefinitely.

**If you ever need to scale:**
- Migrate from SQLite to PostgreSQL
- Use Railway's PostgreSQL addon (one click)
- No code changes needed (same SQL)
- Costs ~$15/month for managed PostgreSQL

---

## Rollback Strategy

### If Something Breaks in Production

**Rollback to previous version:**

1. Go to Railway dashboard
2. View deployment history
3. Select previous working deployment
4. Click "Redeploy"
5. Done! Previous version is live

**Why this is safe:**
- Database persists across deployments
- Data is never lost
- Can rollback in seconds
- Keep trying deployments until one works

---

## Monitoring & Maintenance

### Basic Monitoring (Essential)

- [ ] Uptime monitoring (Railway built-in)
- [ ] Error logs (Railway dashboard)
- [ ] Database disk usage (Railway dashboard)
- [ ] Response times (Railway dashboard)

### Email Alerts (Recommended)

- [ ] Email on deployment failures
- [ ] Email on server down
- [ ] Email on critical errors

**Tools:** Railway provides dashboard alerts, or use Uptime Robot (free)

### Maintenance Schedule

- [ ] Weekly: Check logs for errors
- [ ] Weekly: Verify database backups
- [ ] Monthly: Review Railway usage/costs
- [ ] Quarterly: Update dependencies

---

## Troubleshooting Production

### App Not Starting

1. Check environment variables (all required ones present?)
2. Check logs on Railway dashboard
3. Verify Node version: 24.x required
4. Check database file permissions

### Slow Response Times

1. Check Railway resource usage
2. Check database size
3. Verify segment efforts indexed (see `DATABASE_DESIGN.md`)
4. Consider caching if fetching many leaderboards

### Database Issues

1. Download backup from Railway
2. Verify database integrity: `sqlite3 wmv.db "PRAGMA integrity_check;"`
3. Restore from backup if corrupted
4. Test backup restoration regularly

### OAuth Connection Failing

1. Verify Strava app credentials are correct
2. Check `STRAVA_REDIRECT_URI` matches Strava app settings
3. Check participant tokens in database
4. Try disconnecting/reconnecting manually

---

## Cost Breakdown (Monthly)

### Minimal Setup (Recommended)

| Service | Cost | Notes |
|---------|------|-------|
| Railway (backend) | $0 | Free tier (~$5 credit) |
| Railway (SQLite) | $0 | Included in free tier |
| Strava API | $0 | Free for your usage |
| Domain (optional) | ~$1 | Amortized yearly cost |
| Database backups | ~$1 | S3 storage |
| **Total** | **~$2/mo** | Or free if no custom domain |

### If You Upgrade

| Service | Cost | When |
|---------|------|------|
| Railway beyond free tier | ~$10 | After heavy usage |
| PostgreSQL (if scaling) | ~$15 | If >1000 participants |
| Email service | ~$10 | If sending newsletters |
| **Total | ~$25 | Scaling scenario |

---

## Next Steps

1. **Create Railway account** (takes 5 minutes)
2. **Connect GitHub repo** (Railway walks you through it)
3. **Set environment variables** (copy from .env.example)
4. **Deploy** (Railway auto-deploys on push)
5. **Test** (verify OAuth works, submit a test activity)
6. **Set up backups** (create backup script, run daily)
7. **Announce to club** (share the production URL)

---

## Resources

- [Railway.app Docs](https://docs.railway.app/)
- [Railway GitHub Integration](https://docs.railway.app/guides/github)
- [Railway Environment Variables](https://docs.railway.app/develop/variables)
- [Strava API Settings](https://www.strava.com/settings/api)
- [SQLite Backup Strategy](https://www.sqlite.org/backup.html)

See also:
- `docs/STRAVA_INTEGRATION.md` - OAuth and token management
- `docs/ARCHITECTURE.md` - System design
- `ADMIN_GUIDE.md` - Admin operations
