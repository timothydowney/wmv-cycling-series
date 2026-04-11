#!/usr/bin/env node

function isWindowsPath(pathValue) {
  if (!pathValue) {
    return false;
  }

  const normalizedPath = pathValue.replace(/\\/g, '/').toLowerCase();
  return normalizedPath.startsWith('c:/') || normalizedPath.startsWith('/mnt/c/');
}

const nodeVersion = process.versions.node;
const majorVersion = parseInt(nodeVersion.split('.')[0]);
const nodeExecPath = process.execPath;
const npmExecPath = process.env.npm_execpath || '';

console.log(`[Server] Node.js version: v${nodeVersion}`);
console.log(`[Server] Node executable: ${nodeExecPath}`);

if (npmExecPath) {
  console.log(`[Server] npm executable: ${npmExecPath}`);
}

if (process.platform !== 'linux' || isWindowsPath(nodeExecPath) || isWindowsPath(npmExecPath)) {
  console.error('\n❌ ERROR: Windows Node.js/npm detected inside WSL for server!');
  console.error('This repository must use the Linux Node.js 24 install.');
  console.error(`Node executable: ${nodeExecPath}`);
  if (npmExecPath) {
    console.error(`npm executable: ${npmExecPath}`);
  }
  console.error('\nExpected Linux Node path to resolve first, for example:');
  console.error('  /home/linuxbrew/.linuxbrew/opt/node@24/bin/node\n');
  console.error('To fix this shell:');
  console.error('  export PATH="/home/linuxbrew/.linuxbrew/opt/node@24/bin:$PATH"');
  process.exit(1);
}

if (majorVersion !== 24) {
  console.error('\n❌ ERROR: Wrong Node.js version for server!');
  console.error('This project requires Node.js 24.x (LTS)');
  console.error(`You are using v${nodeVersion}\n`);
  console.error('To fix this:');
  console.error('  nvm use 24');
  console.error('  OR');
  console.error('  nvm install 24 && nvm use 24\n');
  process.exit(1);
}

console.log('✅ Server Node.js version is compatible\n');
