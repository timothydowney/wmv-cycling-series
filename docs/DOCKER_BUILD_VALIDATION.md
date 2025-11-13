# CI/CD Docker Build Validation

This document describes how Docker build validation is integrated into the development and deployment workflows.

## Overview

After fixing the `.dockerignore` issue, we've added Docker build validation to catch production build failures early:

1. **Local validation:** `npm run validate:docker`
2. **GitHub Actions CI:** Docker build step in automated workflow
3. **Railway deployment:** Automatic after GitHub Actions passes

## Local Docker Build Validation

### Usage

Run before pushing to main:

```bash
npm run validate:docker
```

### What It Does

1. ✅ Checks Docker is installed and daemon is running
2. ✅ Builds the Docker image (same build Railway uses)
3. ✅ Verifies test files are excluded from production image
4. ✅ Verifies app can start in Node.js
5. ✅ Verifies production scripts are included
6. ✅ Reports success/failure with clear messaging

### Example Output

```
🐳 Validating Docker build...

📦 Building Docker image (this may take 1-2 minutes)...
✅ Docker build successful!

🔍 Verifying production image...
  - Checking test files are excluded... ✅
  - Checking app can start... ✅
  - Checking production scripts are included... ✅

✅ All validations passed!

Next steps:
  • Push with: git push origin main
  • Railway will auto-deploy when GitHub Actions passes
```

## GitHub Actions Integration

Added Docker build validation to `.github/workflows/ci.yml`:

```yaml
- name: Build Docker image
  run: docker build -t wmv-cycling:ci .
```

**When it runs:** On every push to main and pull request to main

**What it catches:**
- Missing dependencies
- Build failures (npm ci, Vite build, etc.)
- Dockerfile syntax errors
- Permission issues
- `.dockerignore` problems

**Failure behavior:** If Docker build fails, GitHub Actions blocks the deploy step and notifies you via email

## Workflow

### Before Pushing

```bash
# 1. Run all local checks
npm run check

# 2. Validate Docker build (optional but recommended)
npm run validate:docker

# 3. Push to main
git push origin main
```

### After Pushing

1. GitHub Actions runs automatically (see `.github/workflows/ci.yml`)
2. If Docker build fails → Email notification, deploy blocked
3. If Docker build passes → Railway auto-deploys
4. Check Railway dashboard for deployment status

## Benefits

| Scenario | Without Docker Build Validation | With Docker Build Validation |
|----------|--------------------------------|------------------------------|
| npm dependency breaks | ❌ Fails at Railway | ✅ Fails at GitHub Actions CI, caught early |
| Vite build fails | ❌ Fails at Railway | ✅ Fails at GitHub Actions CI, caught early |
| `.dockerignore` excludes needed files | ❌ Fails at Railway | ✅ Fails at GitHub Actions CI, caught early |
| Dockerfile syntax error | ❌ Fails at Railway | ✅ Fails at GitHub Actions CI, caught early |
| Everything works locally but breaks in Docker | ⚠️ 50% chance | ✅ Caught by validation script |

## Cost Savings

- **Railway build minutes:** ~$0.10-0.15 per failed build
- **Email notifications:** Free
- **Local validation:** Free (uses local Docker daemon)
- **GitHub Actions:** Free (included in plan)

With 3-5 failed deployments caught by local validation, saves $0.30-0.75 per month + developer time.

## Files Changed

- `.github/workflows/ci.yml` - Added Docker build step
- `scripts/validate-docker-build.sh` - New validation script
- `package.json` - Added `validate:docker` npm script

## Common Issues

### Docker daemon not running

```
❌ Docker daemon is not running. Start Docker and try again.
```

**Solution:** Start Docker Desktop or `sudo systemctl start docker`

### Docker build takes too long

Typical build time: 1-2 minutes (includes npm ci, Vite build)

**First-time note:** First build pulls ~800MB of dependencies from npm. Subsequent builds use cache and run in ~30 seconds.

### "Cannot find module" errors

If you see module errors during validation:

1. Check your local `npm ci` works: `npm ci && npm test`
2. Clear Docker cache: `docker system prune -a`
3. Retry validation: `npm run validate:docker`

## Future Enhancements

- [ ] Add Docker build to pre-push hook (requires user opt-in)
- [ ] Add Docker build time metrics to GitHub Actions
- [ ] Cache Docker layers in GitHub Actions (speed up CI)
- [ ] Add security scanning to Docker build (Trivy, Snyk)

## Related Documentation

- [Deployment Guide](../docs/DEPLOYMENT.md) - Railway setup details
- [DEV_PROCESS_MANAGEMENT.md](../docs/DEV_PROCESS_MANAGEMENT.md) - Local development process
- [Dockerfile](../Dockerfile) - Production build definition
- [.dockerignore](../.dockerignore) - Files excluded from production image
