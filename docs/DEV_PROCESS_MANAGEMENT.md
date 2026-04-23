# Development Process Management

This document describes the current local development server workflow for this project.

## Quick Decision Guide

**Choose based on your use case:**

### Interactive Development (Recommended for Local Development)
```bash
npm run dev
# → Starts servers in foreground with colored output
# → Stop with Ctrl+C in the terminal
```
**When to use:**
- Working on features locally
- Want to see live output from both servers
- Want natural output coloring (blue = backend, green = frontend)

### Reviewing Production-Like Admin Data Locally
```bash
npm run db:fetch-prod
npm run dev:prod-data
```
**When to use:**
- Reviewing the webhook admin UI against a refreshed local copy of production data
- Judging event history density, enrichment, and admin screen layout with realistic data

### Cleanup
```bash
npm run dev:cleanup
```

Use this if a previous dev or Playwright run left orphaned frontend/backend processes behind.

## Why This Matters

This repo now uses explicit presets instead of one-off shell variables:

- `npm run dev` uses `.env` for the normal local app on `5173` and `3001`.
- `npm run dev:prod-data` uses generated `.env.prod` for local production-copy review on the same ports.
- `npm run test:e2e` uses `e2e/.env.e2e` for Playwright on `5174` and `3002`.

If processes are not shut down properly, you get:
- Orphaned child processes
- Ports still bound, preventing restart
- Multiple instances of servers running simultaneously
- Hard-to-debug state issues

## Current Command Set

| Goal | Command | Notes |
|------|---------|-------|
| Normal local development | `npm run dev` | Standard frontend + backend workflow |
| Review production-like admin data | `npm run db:fetch-prod` then `npm run dev:prod-data` | Same local ports, refreshed production DB copy and `.env.prod` |
| Dedicated Playwright E2E | `npm run test:e2e` | Uses `e2e/.env.e2e` and separate ports |
| Cleanup orphaned local servers | `npm run dev:cleanup` | Safe cleanup for stuck local processes |

## Usage

### Starting Servers

```bash
npm run dev
```

This:
- Starts backend and frontend in the foreground
- Shows colored output in one terminal
- Keeps hot reload active for both sides
- Both servers ready on http://localhost:3001 (backend) and http://localhost:5173 (frontend)

### Starting Against a Refreshed Production DB Copy

```bash
npm run db:fetch-prod
npm run dev:prod-data
```

This keeps the normal local ports and loads generated `.env.prod`, which points the backend at `server/data/wmv_prod.db` and the production secrets fetched from Railway.

### Cleaning Up Orphaned Processes

```bash
npm run dev:cleanup
```

This:
1. Searches for orphaned frontend/backend dev processes
2. Frees the standard local ports when possible
3. Leaves your workspace in a clean state for the next `npm run dev` or `npm run dev:prod-data`

## Key Implementation Details

### File Structure

- **`scripts/dev-server.cjs`** - Process manager (CommonJS because project uses ES modules)
- **`.env.prod`** - Generated local production-copy review preset
- **`e2e/.env.e2e`** - Dedicated Playwright preset

### How Signals Work

**SIGTERM** (graceful shutdown):
- Sent first to allow clean cleanup
- Nodemon and Vite listen for this
- Database connections close properly
- Hot-reload state is preserved

**SIGKILL** (force shutdown):
- Used only if SIGTERM doesn't work
- Forcefully terminates process
- No cleanup possible

## For Agentic/Automated Use

Prefer explicit presets over ad-hoc shell state:

```bash
# Standard local app
npm run dev

# Refresh local production data, then review admin UI against it
npm run db:fetch-prod
npm run dev:prod-data

# If a previous run left ports occupied
npm run dev:cleanup
```

For browser regression tests, do not reuse the normal dev stack. Use the dedicated Playwright preset:

```bash
npm run test:e2e
```

## Troubleshooting

### "Port already in use" Error

If you get an error that port 3001 or 5173 is in use:

```bash
npm run dev:cleanup
```

### Servers Don't Respond

Restart the appropriate preset and watch the live terminal output:

```bash
npm run dev:cleanup
npm run dev
```

## For Interactive Development

In a terminal, you can still use direct mode for richer output:

```bash
npm run dev
```

Stop with `Ctrl+C` in the terminal.

## Implementation Notes

### Why `.cjs` Extension?

The project uses ES modules (`"type": "module"` in package.json), so:
- Most `.js` files are treated as ES modules
- `require()` doesn't work in ES modules
- Solution: Use `.cjs` extension to force CommonJS

### Transaction Safety in Import/Export

The `/admin/import-data` endpoint uses transactions to ensure atomicity:
- Either ALL data imports successfully, or NONE does
- Foreign key constraints are respected
- Proper deletion order prevents FK violations

## See Also

- `docs/ARCHITECTURE.md` - System design
- `docs/CONFIG_QUICK_REFERENCE.md` - Env presets and runtime mode matrix
- `docs/API.md` - API endpoints
- `package.json` - All available scripts
