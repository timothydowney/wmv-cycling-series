#!/usr/bin/env node

/**
 * Process management helper for npm run dev:all
 * 
 * Handles starting/stopping the dev servers cleanly with proper signal handling.
 * 
 * CRITICAL DESIGN:
 * - start: Spawns `npm run dev:all` detached, writes PID, parent exits
 * - stop: Kills the entire process tree (concurrently + nodemon + vite), WAITS for termination
 * - status: Checks if process is alive
 * - cleanup: Force-kills all orphaned dev processes on ports 3001/5173
 * 
 * Usage:
 *   npm run start       - Start servers in background
 *   npm run stop        - Stop servers, wait for termination ✅ THIS NOW WAITS
 *   npm run status      - Check if running
 *   npm run cleanup     - Force-kill orphaned processes
 *
 * The key fix: stop() now WAITS for actual process termination before returning
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const PID_FILE = path.join(process.cwd(), '.dev.pid');
const command = process.argv[2];
const SHUTDOWN_TIMEOUT = 5000; // 5 second timeout for graceful shutdown

function writePidFile(pid) {
  try {
    fs.writeFileSync(PID_FILE, pid.toString(), 'utf8');
  } catch (error) {
    console.error('[dev-server] Failed to write PID file:', error.message);
  }
}

function readPidFile() {
  try {
    if (fs.existsSync(PID_FILE)) {
      return parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
    }
  } catch (error) {
    // Silent fail - file doesn't exist
  }
  return null;
}

function deletePidFile() {
  try {
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE);
    }
  } catch (error) {
    // Ignore - file already deleted
  }
}

function isProcessAlive(pid) {
  try {
    // Sending signal 0 checks if process exists without actually sending a signal
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return false;
  }
}

function getProcessTree(parentPid) {
  /**
   * Returns all PIDs in the process tree rooted at parentPid
   * This handles:
   *   npm run dev:all (parent)
   *     └─ concurrently
   *        ├─ npm run dev:server
   *        │  └─ nodemon
   *        │     └─ tsx
   *        └─ npm run dev
   *           └─ vite
   */
  try {
    const output = execSync(`pgrep -P ${parentPid}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    const childPids = output.trim().split('\n').filter(p => p);
    
    if (childPids.length === 0) return [parentPid];
    
    let allPids = [parentPid, ...childPids];
    
    // Recursively get grandchildren
    for (const childPid of childPids) {
      const grandchildOutput = execSync(`pgrep -P ${childPid}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const grandchildPids = grandchildOutput.trim().split('\n').filter(p => p);
      allPids = [...new Set([...allPids, ...grandchildPids])]; // Deduplicate
    }
    
    return allPids;
  } catch (error) {
    // If pgrep fails, just return the parent
    return [parentPid];
  }
}

function startServers() {
  console.log('[dev-server] Starting dev servers with concurrently...');
  
  // Check if already running
  const existingPid = readPidFile();
  if (existingPid && isProcessAlive(existingPid)) {
    console.log(`[dev-server] Already running with PID ${existingPid}`);
    console.log(`[dev-server] Servers available on:`);
    console.log(`[dev-server]   - Frontend: http://localhost:5173`);
    console.log(`[dev-server]   - Backend: http://localhost:3001`);
    process.exit(0);
  } else if (existingPid) {
    // Stale PID from crashed process
    console.log(`[dev-server] Removing stale PID file (${existingPid})`);
    deletePidFile();
  }
  
  // Spawn concurrently process in detached mode
  // CRITICAL: Do NOT use stdio: 'inherit' with detached: true
  // stdio: 'inherit' causes parent to wait for child's stdio to close
  // Use 'ignore' so child runs completely independently
  const child = spawn('npm', ['run', 'dev:all'], {
    stdio: 'ignore',    // CRITICAL: 'ignore', not 'inherit', so parent doesn't wait
    detached: true,     // Creates new process group; child survives parent exit
    cwd: process.cwd()
  });

  // Write the child process PID to file for later cleanup
  writePidFile(child.pid);
  
  console.log(`[dev-server] ✓ Server started with PID ${child.pid}`);
  console.log(`[dev-server] ✓ Servers running in background on:`);
  console.log(`[dev-server]   - Frontend: http://localhost:5173`);
  console.log(`[dev-server]   - Backend: http://localhost:3001`);
  console.log(`[dev-server] ✓ Run 'npm run stop' to stop servers`);
  console.log(`[dev-server] ✓ Run 'npm run status' to check status`);
  
  // Unref the child so it doesn't keep the parent process alive
  child.unref();
  
  // Exit this parent process immediately
  process.exit(0);
}

function stopServers() {
  const pid = readPidFile();
  
  if (!pid) {
    // Check if servers are running on ports (fallback for interactive mode)
    try {
      const backend = execSync(`lsof -ti:3001 2>/dev/null | head -1`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      const frontend = execSync(`lsof -ti:5173 2>/dev/null | head -1`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      
      if (backend || frontend) {
        console.log('[dev-server] Stopping servers running in interactive mode...');
        const pidsToKill = new Set();
        if (backend) pidsToKill.add(parseInt(backend));
        if (frontend) pidsToKill.add(parseInt(frontend));
        
        // Send SIGTERM
        for (const p of pidsToKill) {
          try {
            process.kill(p, 'SIGTERM');
          } catch (e) {
            // Already dead
          }
        }
        
        // Give it 2 seconds to shutdown gracefully
        setTimeout(() => {
          const stillAlive = Array.from(pidsToKill).filter(p => isProcessAlive(p));
          if (stillAlive.length > 0) {
            console.log('[dev-server] Force killing remaining processes...');
            for (const p of stillAlive) {
              try {
                process.kill(p, 'SIGKILL');
              } catch (e) {
                // Already dead
              }
            }
          }
          console.log('[dev-server] ✓ Servers stopped');
          process.exit(0);
        }, 2000);
        return;
      }
    } catch (e) {
      // Ignore
    }
    
    console.log('[dev-server] ✓ No server running (PID file not found)');
    process.exit(0);
  }

  if (!isProcessAlive(pid)) {
    console.log(`[dev-server] Process ${pid} not found (already stopped)`);
    deletePidFile();
    process.exit(0);
  }

  console.log(`[dev-server] Stopping server (PID ${pid} + children)...`);
  
  // Get all processes in the tree
  const allPids = getProcessTree(pid);
  console.log(`[dev-server] Process tree: ${allPids.join(', ')}`);
  
  // Phase 1: Send SIGTERM to allow graceful shutdown
  console.log(`[dev-server] Phase 1: Sending SIGTERM for graceful shutdown...`);
  for (const p of allPids) {
    try {
      process.kill(p, 'SIGTERM');
    } catch (error) {
      // Process may have already exited
    }
  }
  
  // Phase 2: Wait for graceful shutdown, then force kill if needed
  let shutdownComplete = false;
  let elapsedMs = 0;
  const checkInterval = 100; // Check every 100ms
  
  const waitForShutdown = setInterval(() => {
    elapsedMs += checkInterval;
    
    const stillAlive = allPids.filter(p => isProcessAlive(p));
    
    if (stillAlive.length === 0) {
      // All processes dead!
      clearInterval(waitForShutdown);
      shutdownComplete = true;
      console.log(`[dev-server] ✓ Gracefully shut down after ${elapsedMs}ms`);
      deletePidFile();
      process.exit(0);
    } else if (elapsedMs >= SHUTDOWN_TIMEOUT) {
      // Timeout reached, force kill
      clearInterval(waitForShutdown);
      console.log(`[dev-server] Phase 2: Graceful shutdown timeout, force killing ${stillAlive.length} processes...`);
      
      for (const p of stillAlive) {
        try {
          process.kill(p, 'SIGKILL');
        } catch (error) {
          // Process already gone
        }
      }
      
      // Give it a moment to die, then verify
      setTimeout(() => {
        const remaining = allPids.filter(p => isProcessAlive(p));
        if (remaining.length === 0) {
          console.log(`[dev-server] ✓ Force killed all processes`);
        } else {
          console.warn(`[dev-server] ⚠ ${remaining.length} processes still running: ${remaining.join(', ')}`);
          // Last resort: kill by port
          try {
            execSync(`lsof -ti:3001 2>/dev/null | xargs -r kill -9 2>/dev/null || true`);
            execSync(`lsof -ti:5173 2>/dev/null | xargs -r kill -9 2>/dev/null || true`);
            console.log(`[dev-server] ✓ Killed processes on ports 3001/5173`);
          } catch (e) {
            // Ignore
          }
        }
        deletePidFile();
        process.exit(0);
      }, 500);
    }
  }, checkInterval);
}

function cleanupOrphans() {
  console.log('[dev-server] Cleaning up orphaned dev processes...');
  
  let cleaned = false;
  
  try {
    // Kill processes on dev ports
    const port3001 = execSync(`lsof -ti:3001 2>/dev/null`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    if (port3001) {
      execSync(`kill -9 ${port3001}`, { stdio: 'ignore' });
      console.log(`[dev-server] ✓ Killed process on port 3001: ${port3001}`);
      cleaned = true;
    }
    
    const port5173 = execSync(`lsof -ti:5173 2>/dev/null`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    if (port5173) {
      execSync(`kill -9 ${port5173}`, { stdio: 'ignore' });
      console.log(`[dev-server] ✓ Killed process on port 5173: ${port5173}`);
      cleaned = true;
    }
  } catch (e) {
    // Ignore errors
  }
  
  try {
    // Kill concurrently processes with dev:all
    execSync(`ps aux | grep 'concurrently.*dev:server.*npm:dev' | grep -v grep | awk '{print $2}' | xargs -r kill -9 2>/dev/null || true`);
    
    // Kill nodemon processes running our backend
    execSync(`ps aux | grep 'nodemon.*src/index.ts' | grep -v grep | awk '{print $2}' | xargs -r kill -9 2>/dev/null || true`);
  } catch (e) {
    // Ignore
  }
  
  deletePidFile();
  
  if (!cleaned) {
    console.log('[dev-server] ✓ No orphaned processes found');
  } else {
    console.log('[dev-server] ✓ Cleanup complete');
  }
  
  process.exit(0);
}

function statusServers() {
  const pid = readPidFile();
  
  // Check PID file first
  if (pid && isProcessAlive(pid)) {
    const allPids = getProcessTree(pid);
    console.log(`[dev-server] Status: RUNNING`);
    console.log(`[dev-server]   Main PID: ${pid}`);
    console.log(`[dev-server]   Process tree: ${allPids.join(', ')}`);
    console.log(`[dev-server]   Frontend: http://localhost:5173`);
    console.log(`[dev-server]   Backend:  http://localhost:3001`);
    process.exit(0);
  } else if (pid) {
    console.log(`[dev-server] Status: STALE PID (${pid} not found, cleaning up)`);
    deletePidFile();
  }
  
  // Check if servers are running on ports (fallback for npm run dev:all interactive mode)
  try {
    const backend = execSync(`lsof -ti:3001 2>/dev/null | head -1`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    const frontend = execSync(`lsof -ti:5173 2>/dev/null | head -1`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    
    if (backend || frontend) {
      console.log(`[dev-server] Status: RUNNING (interactive mode - no PID file)`);
      if (backend) console.log(`[dev-server]   Backend PID: ${backend}`);
      if (frontend) console.log(`[dev-server]   Frontend PID: ${frontend}`);
      console.log(`[dev-server]   Frontend: http://localhost:5173`);
      console.log(`[dev-server]   Backend:  http://localhost:3001`);
      console.log(`[dev-server]   Note: Running in interactive mode (npm run dev:all)`);
      console.log(`[dev-server]   Use Ctrl+C to stop, or 'npm run cleanup' to force stop`);
      process.exit(0);
    }
  } catch (e) {
    // Ignore errors
  }
  
  console.log('[dev-server] Status: NOT RUNNING');
  process.exit(1);
}

// Main
if (command === 'start') {
  startServers();
} else if (command === 'stop') {
  stopServers();
} else if (command === 'status') {
  statusServers();
} else if (command === 'cleanup') {
  cleanupOrphans();
} else {
  console.log('Usage: npm run [start|stop|status|cleanup]');
  console.log('');
  console.log('  start   - Start dev servers in background');
  console.log('  stop    - Stop dev servers and wait for termination');
  console.log('  status  - Check if servers are running');
  console.log('  cleanup - Force-kill orphaned dev processes');
  process.exit(1);
}
