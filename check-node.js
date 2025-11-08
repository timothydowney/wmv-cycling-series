#!/usr/bin/env node

const nodeVersion = process.versions.node;
const majorVersion = parseInt(nodeVersion.split('.')[0]);

console.log(`Current Node.js version: v${nodeVersion}`);

if (majorVersion < 20 || majorVersion > 25) {
  console.error('\n❌ ERROR: Wrong Node.js version!');
  console.error('This project requires Node.js v20-25');
  console.error(`You are using v${nodeVersion}\n`);
  console.error('To fix this:');
  console.error('  nvm use 24');
  console.error('  OR');
  console.error('  nvm install 24 && nvm use 24\n');
  process.exit(1);
}

console.log('✅ Node.js version is compatible\n');
