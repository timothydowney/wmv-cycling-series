# Railway.app Deployment Setup Guide

Complete step-by-step walkthrough for deploying WMV Cycling Series to Railway.

## Why Railway?

- ✅ Simple: Deploy directly from GitHub
- ✅ Fast: Auto-deploys on every push to main
- ✅ Cheap: Free tier (~$5 credit) covers this project
- ✅ Reliable: One platform for frontend + backend
- ✅ Perfect scale: Handles 100-1000 participants effortlessly
- ✅ No maintenance: No server management needed

## Prerequisites

- GitHub account with `strava-ncc-scrape` repo access
- Strava OAuth app credentials (from [strava.com/settings/api](https://www.strava.com/settings/api))
- 15 minutes for initial setup

## Step 1: Create Railway Account

### Sign Up

1. Go to **[railway.app](https://railway.app)**
2. Click "Start Free"
3. **Sign in with GitHub** (easiest option)
4. Authorize Railway to access your account
5. Verify email if prompted

That's it! You now have a Railway account.

## Step 2: Create a New Project

### Connect Your GitHub Repository

1. In Railway dashboard, click **"New Project"** (top right)
2. Select **"Deploy from GitHub repo"**
3. Search for **`strava-ncc-scrape`**
4. Click the repo name
5. Click **"Deploy Now"**

Railway will:
- Auto-detect Node.js project
- Start building your app
- Show build logs
- Deploy automatically

**This may take 3-5 minutes on first deploy.** Watch the logs—you should see:
```
npm install
npm run build
npm start
```

## Step 3: Configure Environment Variables

Your app needs secrets to run. Railway will fail to start without them.

### Set Variables in Railway

1. In Railway dashboard, click your **project name**
2. Go to **"Variables"** tab
3. Add each variable below:

| Variable | Value | Where to find |
|----------|-------|---------------|
| `NODE_ENV` | `production` | Type this |
| `PORT` | `3001` | Type this |
| `CLIENT_BASE_URL` | `https://yourapp.railway.app` | Use Railway's generated URL |
| `STRAVA_CLIENT_ID` | Your ID | [strava.com/settings/api](https://www.strava.com/settings/api) |
| `STRAVA_CLIENT_SECRET` | Your secret | [strava.com/settings/api](https://www.strava.com/settings/api) |
| `STRAVA_REDIRECT_URI` | `https://yourapp.railway.app/auth/strava/callback` | Use your Railway URL |
| `DATABASE_PATH` | `/data/wmv.db` | Type this |
| `SESSION_SECRET` | Random string | Generate below |

### Generate SESSION_SECRET

Run this in your terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and paste it as `SESSION_SECRET` value.

### Find Your Strava Credentials

1. Go to [strava.com/settings/api](https://www.strava.com/settings/api)
2. Look for:
   - **Client ID** → Copy to `STRAVA_CLIENT_ID`
   - **Client Secret** → Copy to `STRAVA_CLIENT_SECRET`

### Find Your Railway URL

Once deployment completes:
1. Go to **"Deployments"** tab
2. Click the latest (successful) deployment
3. At the top, see **"Environment URL"** like `https://wmv-xyz.railway.app`
4. Use this for:
   - `CLIENT_BASE_URL`
   - `STRAVA_REDIRECT_URI` (add `/auth/strava/callback`)

## Step 4: Update Strava OAuth Settings

Your Strava app needs to know the production URL.

1. Go to [strava.com/settings/api](https://www.strava.com/settings/api)
2. Update **"Authorization Callback Domain"**:
   - From: `localhost`
   - To: `yourapp.railway.app`
3. Save changes

This tells Strava where to send users after they approve access.

## Step 5: Deploy!

### Automatic Deployment

Every push to `main` branch auto-deploys:

```bash
git add .
git commit -m "Deploy to production"
git push origin main
```

GitHub Actions will:
1. Run tests
2. Build your app
3. Pass to Railway
4. Railway auto-deploys

Check progress in Railway dashboard **"Deployments"** tab.

### First Manual Deploy

If you want to trigger manually:

1. In Railway dashboard, click **"Deployments"**
2. Click the failed deployment (if any)
3. Click **"Redeploy"**

Railway will rebuild and restart.

## Step 6: Test Your Deployment

### Check if it's running

1. Visit your Railway URL: `https://yourapp.railway.app`
2. You should see the WMV website
3. Click **"Connect"** → Should redirect to Strava
4. Log in with your Strava account
5. Authorize the app
6. Should return and show your profile

### If it doesn't work

**Check Railway logs:**
1. Dashboard → Click deployment
2. Scroll to **"Logs"** section
3. Look for error messages
4. Common errors:
   - `Cannot find module` → missing dependency
   - `ENOENT` → missing env variable
   - `CORS error` → check `CLIENT_BASE_URL`

**Check if servers are actually running:**
```bash
# From your local terminal
curl -I https://yourapp.railway.app
```

Should return `200 OK`.

## Step 7: Set Up Database Backups (Optional but Recommended)

Your SQLite database is persistent, but should be backed up.

### Option A: Manual Backup (Simple)

Every week:
1. SSH into Railway (advanced)
2. Download `/data/wmv.db`
3. Store locally

### Option B: Automated Backup (Better)

Create a backup script that runs daily:

```bash
#!/bin/bash
# backup-to-s3.sh

DB_FILE="/data/wmv.db"
BACKUP_NAME="wmv_$(date +%Y%m%d).db"

# Requires AWS CLI + S3 bucket configured
aws s3 cp $DB_FILE s3://your-bucket/backups/$BACKUP_NAME
```

Run via Railway scheduled job (requires paid tier).

**For now:** Manually download the database weekly.

## Troubleshooting

### Build Failed

**Check:**
- Node version: Railway should use 24.x (check `.nvmrc`)
- npm install succeeded: See logs for missing packages
- Environment variables: All required vars set?

**Solution:**
```bash
# Locally test build
npm install
npm run build
```

### App Not Starting

**Check:**
1. All environment variables set (see Step 3)
2. `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` are correct
3. `DATABASE_PATH` is `/data/wmv.db`
4. Port is `3001`

**See logs in Railway:**
- Dashboard → Deployments → Click failing deployment → Logs

### CORS Errors in Frontend

**Check:**
1. Backend is running: Visit `/weeks` endpoint
2. `CLIENT_BASE_URL` env var is correct
3. Browser console shows which origin was rejected

**Fix:**
- Ensure `CLIENT_BASE_URL` matches your Railway URL exactly
- Redeploy after changing it

### Database File Not Persisting

**Check:**
1. Railway has persistent volume configured
2. `DATABASE_PATH` environment variable is `/data/wmv.db`

**Fix:**
- Railway persistent volumes are enabled by default
- No action needed unless you're seeing database reset

## Monitoring

### View Logs

Railway dashboard always shows latest logs. Check regularly for:
- `ERROR` messages
- `WARN` messages
- Failed requests

### Check Resource Usage

1. Dashboard → Click project
2. **"Metrics"** tab shows:
   - CPU usage
   - Memory usage
   - Disk space
3. Typical usage: <50 MB RAM, negligible CPU

**You'll stay in free tier unless:**
- >$5 monthly credit used
- App has massive spike in traffic (unlikely)

### Manual Uptime Check

```bash
# Ping your app
curl -I https://yourapp.railway.app

# Check API
curl https://yourapp.railway.app/weeks
```

## Scaling (Future)

When/if you outgrow Railway (very unlikely):

**More participants (>100):**
- SQLite handles this fine
- No changes needed

**Global users (multiple continents):**
- Consider Fly.io or Cloudflare Workers
- Railway works for US-only

**Massive traffic:**
- Upgrade to Railway's paid tier (~$10/month)
- Add PostgreSQL if needed

**For now:** Don't worry about scaling. This setup handles your club perfectly.

## Cost Tracking

### Monthly Costs

| Item | Cost | Notes |
|------|------|-------|
| Railway (compute) | $0 | Free tier covers this |
| Database (SQLite) | $0 | No extra charge |
| Backups (optional S3) | ~$1 | Very cheap |
| **Total** | **~$1/month** | Or $0 if no backups |

### When You'll Need to Pay

- After using $5 free credit (takes months of heavy use)
- When compute + storage exceed free tier
- For scheduled backup jobs (requires paid tier)

### Monitoring Costs

In Railway dashboard:
1. Click project
2. **"Metrics"** tab
3. Scroll to **"Spend"**
4. Shows current month's usage

You'll get email alerts before charges apply.

## Advanced: CI/CD with GitHub Actions

Your repository already has GitHub Actions CI/CD configured!

### What Happens Automatically

Every push to main:
1. GitHub Actions runs tests
2. Builds both frontend + backend
3. If successful → Railway auto-deploys
4. If failed → Dashboard shows error

### Check Build Status

1. Go to repo on GitHub
2. Click **"Actions"** tab
3. See history of all builds
4. Click a run to see details

### Branch Protection

Recommended: Require CI to pass before merge

1. Go to GitHub repo settings
2. **"Branches"** → **"Branch protection rules"**
3. Add rule for `main` branch
4. Require status checks to pass before merging

This prevents broken code reaching production.

## Next Steps

1. ✅ Create Railway account (5 min)
2. ✅ Connect GitHub repo (automated)
3. ✅ Set environment variables (5 min)
4. ✅ Test with Strava OAuth (2 min)
5. ✅ Update Strava app settings (2 min)
6. ✅ Push to main branch (auto-deploys)
7. ✅ Monitor logs for a few days (ongoing)

**Total setup time: ~20 minutes**

## Resources

- [Railway Documentation](https://docs.railway.app/)
- [Railway GitHub Integration](https://docs.railway.app/guides/github)
- [Railway Environment Variables](https://docs.railway.app/develop/variables)
- [Strava API Settings](https://www.strava.com/settings/api)

## Questions?

See also:
- `docs/DEPLOYMENT.md` - General deployment overview
- `docs/STRAVA_INTEGRATION.md` - OAuth and token management
- `docs/ARCHITECTURE.md` - System design
- `ADMIN_GUIDE.md` - Admin operations
