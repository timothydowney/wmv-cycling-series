const { execSync } = require('child_process');

function killPort(port) {
  try {
    // Only kill TCP listening ports
    const pids = execSync(`lsof -t -i tcp:${port} -s tcp:listen`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    if (pids) {
      const list = pids.replace(/\n/g, ' ');
      console.log(`[kill-e2e-ports] Releasing port ${port} (PIDs: ${pids.replace(/\n/g, ',')})`);
      execSync(`kill -9 ${list}`, { stdio: 'ignore' });
    }
  } catch (error) {
    // Port is likely already free
  }
}

console.log('[kill-e2e-ports] Checking for stale E2E processes on ports 3002 and 5174...');
killPort(3002);
killPort(5174);
console.log('[kill-e2e-ports] Cleanup complete');
