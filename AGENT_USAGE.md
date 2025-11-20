# How Agents Should Use This Project

## Problem: Dev Server Process Management

When an agentic workflow (like Copilot) runs terminal commands:
- `run_in_terminal` with `isBackground=true` doesn't truly daemonize Node processes
- It becomes idle before child processes fully initialize
- This leaves orphaned processes that can't be cleaned up
- The .dev.pid file may not be created in time

## The Issue (Now Resolved)

Previously, `npm start` had issues with true background operation. This has been fixed:

```bash
npm start
# This spawns: npm -> node scripts/dev-server.cjs -> npm run dev:all -> concurrently -> nodemon + vite
# NEW: Properly daemonized with detached: true and child.unref()
# RESULT: Returns immediately AND child processes continue in background
```

## Solution: Use npm start (Now Truly Safe for Agents)

### ✅ DO THIS (Now works correctly):
```bash
run_in_terminal({
  command: "npm start",
  isBackground: true
})
```

### ✅ DO THIS INSTEAD:

**Option A: Use npm test (runs without servers)**
```bash
run_in_terminal({
  command: "npm test",
  isBackground: false  // Blocking is fine, tests complete
})
```

**Option B: Use npm run build (doesn't require servers)**
```bash
run_in_terminal({
  command: "npm run build",
  isBackground: false  // Blocking is fine, build completes
})
```

**Option C: Use npm run lint (doesn't require servers)**
```bash
run_in_terminal({
  command: "npm run lint:all",
  isBackground: false  // Blocking is fine, linting completes
})
```

## If Orphaned Processes Appear

Use the safe cleanup command:

```bash
npm cleanup
```

This will:
- Kill ONLY concurrently processes started with `npm:dev:server npm:dev`
- Kill ONLY nodemon processes running `server/src/index.js`
- Kill ONLY processes on ports 3001 (backend) and 5173 (frontend)
- **Will NOT** kill VSCode server processes or other Node processes
- Remove stale .dev.pid files

## Why This Is Safe

The cleanup script uses specific patterns to identify dev server processes:
1. **Concurrently matching:** Only kills concurrently with both dev:server AND npm:dev arguments
2. **Nodemon matching:** Only kills nodemon running the exact server path
3. **Port-based:** Uses `lsof` to kill by port (more reliable than process name)
4. **Never uses broad pkill patterns** that would catch VSCode or other tools

## Summary for Agents

1. **Start dev servers with `npm start`** - Now properly daemonized for agents
2. **Check status with `npm status`** - Verify servers are running
3. **Stop gracefully with `npm stop`** - Clean shutdown
4. **Use `npm cleanup` if needed** - Emergency: force-kill orphaned processes
5. **Don't use broad pkill patterns** - Let the script manager handle it
6. **For one-off tasks** (test, build, lint) - Use blocking terminal commands

