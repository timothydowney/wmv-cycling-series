# How Agents Should Use This Project

## Problem: Dev Server Process Management

When an agentic workflow (like Copilot) runs terminal commands:
- `run_in_terminal` with `isBackground=true` doesn't truly daemonize Node processes
- It becomes idle before child processes fully initialize
- This leaves orphaned processes that can't be cleaned up
- The .dev.pid file may not be created in time

## The Issue with `npm run dev:start`

```bash
npm run dev:start
# This spawns: npm -> node scripts/dev-server.cjs -> npm run dev:all -> concurrently -> nodemon + vite
# BUT: The terminal returns immediately (before .dev.pid is written)
# RESULT: Orphaned processes that can't be stopped
```

## Solution: DON'T Use Dev Servers During Agentic Work

### ❌ DON'T DO THIS (It will orphan processes):
```bash
run_in_terminal({
  command: "npm run dev:start",
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

Use the new safe cleanup command that only targets dev server processes:

```bash
npm run dev:cleanup
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

1. **Don't start dev servers unless explicitly asked by user**
2. **Always use blocking terminal commands for one-off tasks (test, build, lint)**
3. **If cleanup needed, use `npm run dev:cleanup`** (safe and specific)
4. **Never use broad pkill patterns** - let the script manager handle it
5. **If user wants dev servers, tell them:** "Run `npm run dev:all` in your terminal"

