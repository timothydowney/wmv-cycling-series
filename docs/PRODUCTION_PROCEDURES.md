# Production Deployment Procedures

Standard operating procedures for deploying WMV Cycling Series to production on Railway.

## Pre-Deployment Checklist

**Run before EVERY deployment to production:**

```bash
# 1. Make sure all tests pass
npm test

# 2. Build locally to verify
npm run build

# 3. Check for linting issues
npm run lint

# 4. Verify Node version is 24.x
node --version  # Should be v24.x.x

# 5. If all pass, commit and push
git add .
git commit -m "Descriptive message about what's changing"
git push origin main
```

**After push:**
- GitHub Actions runs automatically
- Check [GitHub Actions page](https://github.com/timothydowney/wmv-cycling-series/actions)
- If ✅ pass: Railway auto-deploys
- If ❌ fail: Fix and retry

## First Production Deploy Checklist

Before going live for the first time:

- [ ] Railway account created and project connected
- [ ] All environment variables set in Railway dashboard:
  - [ ] `NODE_ENV=production`
  - [ ] `PORT=3001`
  - [ ] `CLIENT_BASE_URL` points to production Railway URL
  - [ ] `STRAVA_CLIENT_ID` from Strava app
  - [ ] `STRAVA_CLIENT_SECRET` from Strava app
  - [ ] `STRAVA_REDIRECT_URI` matches production URL
  - [ ] `DATABASE_PATH=/data/wmv.db`
  - [ ] `SESSION_SECRET` generated and set
- [ ] Strava OAuth app updated with production domain
- [ ] GitHub Actions CI/CD working (tests passing)
- [ ] Database initialization tested (created seed data)
- [ ] Test Strava OAuth flow in production:
  - [ ] Visit production URL
  - [ ] Click "Connect"
  - [ ] Redirected to Strava
  - [ ] Can authorize
  - [ ] Returned to app
  - [ ] Can see participant info
- [ ] Admin interface working
- [ ] Leaderboards display correctly
- [ ] No console errors in browser DevTools
- [ ] No error logs in Railway dashboard

## Standard Deployment Process

### Scenario 1: New Feature or Bug Fix

1. **Develop locally:**
   ```bash
   npm run dev:all  # Both servers running
   # Make changes, test thoroughly
   npm test         # Ensure tests pass
   ```

2. **Commit and push:**
   ```bash
   git add .
   git commit -m "Add feature: [description]"
   git push origin main
   ```

3. **GitHub Actions runs:** Automatically tests and builds

4. **Railway deploys:** Automatically when CI passes

5. **Verify in production:**
   - Check Railway deployment status
   - Visit production URL
   - Spot-check features that changed
   - Check Railway logs for errors

### Scenario 2: Urgent Hotfix

Same as above, but with more urgency:

1. **Make minimal changes** to fix the issue
2. **Test thoroughly** before committing
3. **Push to main** (auto-deploys)
4. **Monitor closely** for first 30 minutes

### Scenario 3: Rolling Back (Oops!)

If something breaks in production:

**Option A: Quick Rollback (Recommended)**

1. In Railway dashboard:
   - Click "Deployments" tab
   - Find the last working deployment
   - Click it
   - Click "Redeploy"
2. Done! Previous version is now live
3. Check logs and website to confirm

**Option B: Code Rollback**

1. In GitHub:
   - Click latest commit
   - Click "Revert"
   - This creates a new commit that undoes changes
2. Push the revert commit
3. Railway auto-deploys with old code

**After rolling back:**
- Investigate what went wrong
- Fix locally
- Re-deploy when ready

## Monitoring After Deploy

### Immediately After Deploy (First 30 minutes)

✅ **Do:**
- Watch Railway logs for errors
- Test critical features manually
- Check browser console for JS errors
- Verify database is working

❌ **Don't:**
- Leave unattended
- Trust it just because it deployed
- Announce to users yet

### The First Hour

- Website still loading correctly?
- No spike in errors?
- Database still there?
- All features working?

If anything looks wrong: **Rollback immediately** (see above)

### First Day

- Monitor logs periodically
- No sustained error patterns?
- Response times reasonable?
- Database growing normally (not exploding)?

### First Week

- Any participant issues reported?
- System stable for full week?
- All weekly functions working?
- Ready to consider "stable"

## Performance Monitoring

### Key Metrics to Watch

Check Railway dashboard → Metrics:

| Metric | Expected | Warning | Critical |
|--------|----------|---------|----------|
| CPU | <5% | >25% | >50% |
| Memory | 30-50 MB | >200 MB | >300 MB |
| Disk | <100 MB | >500 MB | >1 GB |
| Response time | <500ms | >2s | >5s |

Your app should barely use resources at this scale.

### Check Resource Usage

```bash
# From your local machine, test production endpoint
curl -w "Response time: %{time_total}s\n" https://yourapp.railway.app/weeks
```

Should be <500ms with minimal resource usage.

## Database Maintenance

### Backup Strategy

**Recommended: Weekly manual backup**

1. SSH into Railway (advanced) or
2. Export from Railway dashboard (if available)
3. Download `wmv.db`
4. Store locally

**For now:** Focus on having Railway persistent volume enabled (default)

### Database Health Check

If you ever suspect database issues:

```bash
# Connect to production database
sqlite3 /data/wmv.db

# Check integrity
PRAGMA integrity_check;

# Check size
SELECT page_count * page_size / 1024 / 1024 AS size_mb FROM pragma_page_count(), pragma_page_size();

# Exit
.quit
```

### When to Backup

- Before major deployments
- Weekly on a schedule
- After major data changes
- Before making database schema changes

## Deployment Schedule Recommendations

### Release Cycle

**Recommended rhythm:**
- **Weekly:** Fix bugs, small improvements
- **Monthly:** Larger features
- **As needed:** Urgent hotfixes

### Deployment Times

**Best practices:**
- Deploy during club downtime
- Avoid deploying just before competition
- Test for 30 minutes after deploy
- Don't deploy Friday afternoon (hard to monitor)

**Suggested:**
- Tuesday/Wednesday mornings
- After testing for errors overnight

### Communication

**Before deploying:**
- Make sure no active competitions
- Plan for 15-30 minutes of attention afterward

**After deploying:**
- Wait 1 hour before declaring success
- Be ready to rollback if needed
- Monitor logs through first day

## Common Issues During Deploy

### Build Fails in GitHub Actions

**Check:**
1. Tests pass locally: `npm test`
2. Build works locally: `npm run build`
3. All dependencies installed: `npm install`
4. Node version correct: `.nvmrc` specifies 24.x

**Fix:**
```bash
npm ci  # Clean install
npm run build
git add .
git commit -m "Fix build"
git push origin main
```

### Railway Deploy Fails

**Check:**
1. All environment variables set
2. No typos in SECRET variables
3. Database path is `/data/wmv.db`
4. Previous deployment actually completed

**Fix:**
1. Click "Redeploy" in Railway dashboard
2. Watch logs for specific error
3. Fix environment variables if needed
4. Redeploy again

### App Starts but Crashes

**Check Railway logs for:**
- `Cannot find module` → Missing dependency
- `ENOENT` → Missing file or env var
- `undefined` → Configuration issue
- Connection errors → Database issue

**Fix:**
1. Identify error from logs
2. Fix locally
3. Push to main
4. Redeploy

### CORS Errors in Frontend

**Cause:** Client and server on different domains

**Check:**
1. `CLIENT_BASE_URL` matches your Railway URL exactly
2. Includes `https://` (not `http://`)
3. No trailing slash

**Fix:**
```bash
# Update in Railway dashboard environment variables
CLIENT_BASE_URL=https://yourapp.railway.app  # Remove trailing slash
# Redeploy
```

### Database File Missing

**Cause:** Persistent volume not configured or wrong path

**Check:**
1. `DATABASE_PATH=/data/wmv.db`
2. Railway persistent volume enabled

**Fix:**
1. Ensure `DATABASE_PATH` env var is exactly `/data/wmv.db`
2. Redeploy
3. Should auto-create on first run

## Post-Deploy Checklist

After every production deployment, verify:

- [ ] Railway shows "success" on latest deployment
- [ ] No errors in Railway logs
- [ ] Website loads in browser
- [ ] Can navigate to main pages
- [ ] No 500 errors in console
- [ ] Can view leaderboards
- [ ] Admin panel accessible (if applicable)
- [ ] GitHub commit has green ✓ checkmark
- [ ] No sustained errors in first 30 minutes

## Escalation Plan

### If Something Breaks

**Level 1: Minor Issue** (cosmetic bugs, slow response)
- Investigate with logs
- Deploy fix on next cycle
- No immediate action needed

**Level 2: Major Issue** (features not working)
- Immediately rollback to previous version
- Investigate root cause
- Test fix thoroughly
- Re-deploy when confident

**Level 3: Critical Issue** (data loss, security)
- Immediate rollback
- Take app offline if needed
- Investigate thoroughly
- Only re-deploy after fix verified

**For critical issues:**
1. Rollback immediately
2. Post-mortem: what went wrong?
3. Add tests to prevent in future
4. Only re-deploy when absolutely sure

## Disaster Recovery

### If Database Gets Corrupted

1. **Immediate action:**
   - Rollback deployment to before corruption
   - Take app offline if needed
   - Restore from backup

2. **Investigation:**
   - When did corruption start?
   - What deployment caused it?
   - Was it a code change or data issue?

3. **Recovery:**
   - Restore from clean backup
   - Re-import participant data if needed
   - Test thoroughly before re-deploying

### If You Need to Restore from Backup

1. Download backup from storage
2. Create new persistent volume in Railway
3. Upload backup database
4. Update `DATABASE_PATH` if needed
5. Restart Railway deployment
6. Verify data restored correctly

## Documentation & Logs

### Keep Records

- [ ] Deployment date/time
- [ ] What changed
- [ ] Any issues encountered
- [ ] Rollback information if applicable

### Check Logs Regularly

**Daily during first week:**
- Any unusual error patterns?
- Unexpected behavior?
- Performance issues?

**Weekly ongoing:**
- Review error logs
- Check for trends
- Monitor resource usage

## Success Criteria

A deployment is successful when:

✅ All tests pass before deploy
✅ No build errors in GitHub Actions
✅ Railway deployment shows "success"
✅ Website loads without errors
✅ Core features working
✅ No error spike in logs
✅ Stable for at least 1 hour

---

**See also:**
- `docs/RAILWAY_SETUP.md` - Initial Railway setup
- `docs/DEPLOYMENT.md` - General deployment overview
- `ADMIN_GUIDE.md` - Administrative tasks
