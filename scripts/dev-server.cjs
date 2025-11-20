#!/usr/bin/env node

/**
 * Process management helper for npm run dev:all
 * 
 * Handles starting/stopping the dev servers cleanly with proper signal handling.
 * Writes parent PID to .dev.pid file for clean shutdown.
 * 
 * Usage:
 *   node scripts/dev-server.js start  - Start servers, write PID, keep process running
 *   node scripts/dev-server.js stop   - Read PID from file, send SIGTERM, cleanup
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

const PID_FILE = path.join(process.cwd(), '.dev.pid');
const command = process.argv[2];

function writePidFile(pid) {
  try {
    fs.writeFileSync(PID_FILE, pid.toString(), 'utf8');
  } catch (error) {
    console.error('Failed to write PID file:', error.message);
  }
}

function readPidFile() {
  try {
    if (fs.existsSync(PID_FILE)) {
      return parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
    }
  } catch (error) {
    console.error('Failed to read PID file:', error.message);
  }
  return null;
}

function deletePidFile() {
  try {
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE);
    }
  } catch (error) {
    console.error('Failed to delete PID file:', error.message);
  }
}

function startServers() {
  console.log('[dev-server] Starting dev servers with concurrently...');
  
  // Spawn concurrently process in detached mode
  // This allows the child to outlive the parent process
  const child = spawn('npm', ['run', 'dev:all'], {
    stdio: 'inherit',
    detached: true,  // Creates new process group; child survives parent exit
    cwd: process.cwd()
  });

  // Write the child process PID to file for later cleanup
  writePidFile(child.pid);
  console.log(`[dev-server] Server started with PID ${child.pid}`);
  console.log(`[dev-server] Servers running in background on:`);
  console.log(`[dev-server]   - Frontend: http://localhost:5173`);
  console.log(`[dev-server]   - Backend: http://localhost:3001`);
  
  // CRITICAL: Ensure PID file is written before this parent exits
  if (!fs.existsSync(PID_FILE)) {
    console.error('[dev-server] FATAL: Failed to write PID file');
    process.exit(1);
  }
  
  // Unref the child so it doesn't keep the parent process alive
  // This allows the parent (this script) to exit
  child.unref();
  
  // Exit this parent process immediately
  // The child process continues running in background
  console.log('[dev-server] Parent process exiting (servers continue in background)');
  process.exit(0);
}

function stopServers() {
  const pid = readPidFile();
  
  if (!pid) {
    console.log('[dev-server] No dev server running (PID file not found)');
    return;
  }

  console.log(`[dev-server] Stopping dev server (PID ${pid})...`);
  
  try {
    // Check if process exists
    process.kill(pid, 0);
    
    // Send SIGTERM to gracefully shutdown
    process.kill(pid, 'SIGTERM');
    console.log(`[dev-server] Sent SIGTERM to PID ${pid}`);
    
    // Wait for graceful shutdown, then check if child processes are still running
    setTimeout(() => {
      try {
        process.kill(pid, 0);
        // Parent still alive
        console.log(`[dev-server] Parent still running, force terminating...`);
        
        // Kill ONLY this specific process tree, not ALL nodemon/vite globally
        // This is crucial to not interfere with other processes or VSCode
        const { execSync } = require('child_process');
        try {
          // Only kill children of the specific PID we started
          execSync(`ps --ppid ${pid} -o pid= | xargs -r kill -9 2>/dev/null || true`);
          // Then kill the parent
          process.kill(pid, 'SIGKILL');
          console.log(`[dev-server] Force killed process tree (PID ${pid})`);
        } catch (e) {
          // If tree kill fails, just kill the parent
          process.kill(pid, 'SIGKILL');
        }
      } catch (error) {
        // Process already dead, good!
        console.log('[dev-server] Process already terminated');
      }
      
      deletePidFile();
      console.log('[dev-server] Stopped');
    }, 1500);
  } catch (error) {
    if (error.code === 'ESRCH') {
      // Process doesn't exist
      console.log(`[dev-server] Process ${pid} not found (already terminated)`);
      deletePidFile();
    } else {
      console.error('[dev-server] Error stopping server:', error.message);
      process.exit(1);
    }
  }
}

function cleanupOrphans() {
  console.log('[dev-server] Cleaning up orphaned dev processes...');
  
  const { execSync } = require('child_process');
  
  // Strategy: Kill only processes that are part of the dev server chain
  // AND are NOT VSCode processes
  try {
    // Find all concurrently processes that started npm run dev:all
    // Look for: concurrently ... npm:dev:server npm:dev
    execSync(`ps aux | grep 'concurrently.*dev:server.*npm:dev' | grep -v grep | awk '{print $2}' | xargs -r kill -9 2>/dev/null || true`);
    
    // Find orphaned nodemon processes that are running server/src/index.js
    // (not other nodemon processes)
    execSync(`ps aux | grep 'nodemon src/index.js' | grep -v grep | awk '{print $2}' | xargs -r kill -9 2>/dev/null || true`);
    
    // Find vite processes in the strava repo dir specifically
    execSync(`lsof -ti:5173 2>/dev/null | xargs -r kill -9 2>/dev/null || true`);
    execSync(`lsof -ti:3001 2>/dev/null | xargs -r kill -9 2>/dev/null || true`);
    
    console.log('[dev-server] Cleanup complete');
  } catch (e) {
    // Ignore errors - some commands might not find anything
    console.log('[dev-server] Cleanup finished (some processes may not have existed)');
  }
  
  // Clean up the PID file
  deletePidFile();
}

function statusServers() {
  const pid = readPidFile();
  
  if (!pid) {
    console.log('[dev-server] Status: NOT RUNNING');
    return;
  }

  try {
    process.kill(pid, 0);
    console.log(`[dev-server] Status: RUNNING (PID ${pid})`);
  } catch (error) {
    console.log(`[dev-server] Status: STALE PID (${pid} not found, cleaning up)`);
    deletePidFile();
  }
}

// Main
if (command === 'start') {
  // Check if already running
  const existingPid = readPidFile();
  if (existingPid) {
    try {
      process.kill(existingPid, 0);
      console.log(`[dev-server] Already running with PID ${existingPid}`);
      process.exit(0);
    } catch (error) {
      // Stale PID, proceed
      deletePidFile();
    }
  }
  
  startServers();
} else if (command === 'stop') {
  stopServers();
} else if (command === 'status') {
  statusServers();
} else if (command === 'cleanup') {
  cleanupOrphans();
} else {
  console.log('Usage: node scripts/dev-server.js [start|stop|status|cleanup]');
  process.exit(1);
}
