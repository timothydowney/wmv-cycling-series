# Railway Deployment Checklist

Quick reference for deploying to Railway.

## 🚀 Quick Setup (15 minutes)

- [ ] **Create Railway account** → [railway.app](https://railway.app) → Sign in with GitHub
- [ ] **Create project** → Railway dashboard → "New Project" → Select GitHub repo
- [ ] **Get Railway URL** → Dashboard → Deployments → Copy `https://yourapp-xyz.railway.app`
- [ ] **Set environment variables** in Railway:
  - [ ] `NODE_ENV` = `production`
  - [ ] `PORT` = `3001`
  - [ ] `CLIENT_BASE_URL` = `https://yourapp.railway.app`
  - [ ] `DATABASE_PATH` = `/data/wmv.db`
  - [ ] `STRAVA_CLIENT_ID` = (from Strava settings)
  - [ ] `STRAVA_CLIENT_SECRET` = (from Strava settings)
  - [ ] `STRAVA_REDIRECT_URI` = `https://yourapp.railway.app/auth/strava/callback`
  - [ ] `SESSION_SECRET` = (generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- [ ] **Update Strava app** → [strava.com/settings/api](https://www.strava.com/settings/api)
  - [ ] Authorization Callback Domain = `yourapp.railway.app`
- [ ] **Test deployment** → Visit `https://yourapp.railway.app`
  - [ ] Website loads
  - [ ] Click "Connect" → redirects to Strava
  - [ ] Can log in and authorize

## 📦 After First Deploy

- [ ] CI/CD working: Push to main triggers auto-deploy ✓ (already configured)
- [ ] Monitor Railway logs for errors
- [ ] Test Strava OAuth flow with real account
- [ ] Database created at `/data/wmv.db`

## 🔄 Ongoing

**Every deploy:**
- Push to `main` branch
- GitHub Actions runs tests
- If passing → Railway auto-deploys
- Check deployment status in Railway dashboard

**Weekly:**
- Check Railway logs for errors
- Monitor resource usage (should be minimal)
- Manually backup database if needed

**Monthly:**
- Review costs (should be $0-5/month)
- Check for dependency security updates

## 🆘 If Something Breaks

| Problem | Solution |
|---------|----------|
| Build failed | Check Railway logs for errors; verify env vars |
| App won't start | Check all env vars set; verify STRAVA credentials |
| CORS errors | Ensure `CLIENT_BASE_URL` matches Railway URL |
| OAuth doesn't work | Update Strava OAuth callback domain |
| Database missing | Verify `DATABASE_PATH` = `/data/wmv.db` |
| Stuck processes | Railway handles this; just redeploy |

**Quick fix:** Click "Redeploy" in Railway dashboard

## 📚 Full Documentation

- See `docs/RAILWAY_SETUP.md` for complete walkthrough
- See `docs/DEPLOYMENT.md` for deployment overview
- See `ADMIN_GUIDE.md` for running the app in production

## 💰 Cost

- **Free tier:** $5/month credit (covers this project completely)
- **Typical cost:** $0-2/month after free credit runs out
- **When to upgrade:** Only if app gets massive traffic (unlikely)

Monitor spending in Railway dashboard → Metrics → Spend
