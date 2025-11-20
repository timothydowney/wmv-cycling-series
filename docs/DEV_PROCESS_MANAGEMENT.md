# Development Process Management

This document describes how to properly start and stop the development servers for this project in a clean, reliable way.

## Quick Decision Guide

**Choose based on your use case:**

### Interactive Development (Recommended for Local Development)
```bash
npm run dev:all
# → Starts servers in foreground with colored output
# → Stop with Ctrl+C in the terminal
```
**When to use:**
- Working on features locally
- Want to see live output from both servers
- Want natural output coloring (blue = backend, green = frontend)

### Automated/Agentic Use (For Scripts & Agents)
```bash
npm start          # Start once, background process
npm status         # Check if running
npm stop           # Stop cleanly (normal case)
npm cleanup        # Stop forcefully (emergency only)
```
**When to use:**
- Running in background while you do other work
- Automated testing/deployment scripts
- CI/CD pipelines
- Agentic/programmatic workflows

**Stopping strategy:**
- **Normal:** Use `npm stop`
- **If that fails:** Use `npm cleanup` to force-kill all dev processes
- **Emergency:** If you need guaranteed cleanup regardless of state

## Why This Matters

When developing a monorepo with a separate frontend and backend, process management is critical:

- **Frontend** (Vite) runs on port 5173
- **Backend** (Node.js + nodemon) runs on port 3001
- Both are started by **concurrently** parent process

If processes aren't shut down properly, you get:
- Orphaned child processes
- Ports still bound, preventing restart
- Multiple instances of servers running simultaneously
- Hard-to-debug state issues

## The Solution: Process PID Tracking

For automated use, we use a `.dev.pid` file to track the child process:

1. **`npm start`** - Starts servers and writes child PID to `.dev.pid`, returns immediately
2. **`npm stop`** - Reads PID, sends SIGTERM (graceful shutdown), then SIGKILL if needed
3. **`npm status`** - Shows if servers are running
4. **`npm cleanup`** - Emergency: kills all orphaned dev processes (no tracking needed)

## Usage

### Starting Servers

```bash
npm start
```

This:
- Starts concurrently (parent process) in detached mode
- Starts nodemon + vite as children
- Writes child PID to `.dev.pid`
- Returns immediately to terminal (parent process exits)
- Both servers ready on http://localhost:3001 (backend) and http://localhost:5173 (frontend)

### Checking Status

```bash
npm status
```

Output:
```
[dev-server] Status: RUNNING (PID 34909)
```

### Stopping Servers

```bash
npm stop
```

This:
1. Reads PID from `.dev.pid`
2. Sends SIGTERM to child (graceful shutdown request)
3. Waits 1.5 seconds for children to shutdown
4. If still running, force-kills child processes (nodemon, vite)
5. Deletes `.dev.pid` file
6. Cleans up all ports

### Emergency Cleanup (Orphaned Processes)

If you end up with orphaned dev processes (e.g., multiple concurrently instances):

```bash
npm cleanup
```

This:
1. Searches for ALL concurrently processes with dev:server pattern
2. Searches for ALL nodemon processes running server/src/index.ts
3. Kills processes on ports 3001 (backend) and 5173 (frontend)
4. Deletes `.dev.pid` file
5. **Does NOT require a valid .dev.pid file to work**

**When to use:**
- You have multiple orphaned dev server processes
- `npm stop` didn't work (no valid PID file)
- You need guaranteed cleanup regardless of state

**Why it's safe:**
- Uses specific pattern matching (only dev server processes)
- Uses port-based detection (more reliable than process names)
- Won't interfere with other Node.js processes or VSCode

## Key Implementation Details

### File Structure

- **`scripts/dev-server.cjs`** - Process manager (CommonJS because project uses ES modules)
- **`.dev.pid`** - Stores parent PID (gitignored, never committed)
- **`.gitignore`** - Includes `.dev.pid` to prevent accidental commits

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

### Package.json Scripts

```json
{
  "dev:all": "concurrently...",    // Direct concurrently (still available)
  "start": "npm run dev:start",     // Idiomatic alias: npm start (start in background)
  "stop": "npm run dev:stop",       // Idiomatic alias: npm stop (stop background)
  "status": "npm run dev:status",   // Idiomatic alias: npm status (check status)
  "cleanup": "npm run dev:cleanup"  // Idiomatic alias: npm cleanup (emergency cleanup)
}
```

**Use the idiomatic commands:**
```bash
npm start    # Instead of: npm run dev:start
npm stop     # Instead of: npm run dev:stop
npm status   # Instead of: npm run dev:status
npm cleanup  # Instead of: npm run dev:cleanup
```

## For Agentic/Automated Use

This process manager is specifically designed for reliable automation:

```bash
# Start once and keep running
npm start

# Do some work...
curl http://localhost:3001/admin/export-data

# Stop cleanly
npm stop

# Verify clean shutdown
npm status
# Should show: "NOT RUNNING"
```

### Benefits Over Background `&`

| Aspect | Using `npm start` | Using `npm run dev:all &` |
|--------|--------------------------|--------------------------|
| PID tracking | ✅ Stored in `.dev.pid` | ❌ Must hunt for PID |
| Shutdown | ✅ `npm stop` kills cleanly | ❌ Must use `kill`, `pkill`, `lsof` hacks |
| Status | ✅ `npm status` | ❌ Must check `ps`, `lsof` manually |
| Idempotent | ✅ Detects already-running | ❌ Creates duplicates |
| Port cleanup | ✅ Proper SIGTERM cascade | ❌ Orphaned processes |

## Troubleshooting

### "Port already in use" Error

If you get an error that port 3001 or 5173 is in use:

```bash
npm stop
```

If that doesn't work:

```bash
# Manual cleanup
lsof -ti:3001 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null
rm -f .dev.pid
```

### "Status: STALE PID"

This means the `.dev.pid` file references a process that no longer exists (maybe it crashed):

```bash
npm stop
# Will clean up the stale PID and notify you
```

### Servers Don't Respond

Check the log output if you started with output redirection:

```bash
tail -20 /tmp/dev-start.log  # If you redirected output
```

## For Interactive Development

In a terminal, you can still use direct mode for richer output:

```bash
npm run dev:all
```

Stop with `Ctrl+C` in the terminal - this naturally sends SIGTERM to concurrently.

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
- `docs/API.md` - API endpoints
- `package.json` - All available scripts
