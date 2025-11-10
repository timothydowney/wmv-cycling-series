#!/usr/bin/env node

const nodeVersion = process.versions.node;
const majorVersion = parseInt(nodeVersion.split('.')[0]);

console.log(`[Server] Node.js version: v${nodeVersion}`);

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
