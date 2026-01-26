// scripts/install-hooks.cjs
// Install git pre-commit hook that runs linters for both frontend and backend

const fs = require('fs');
const path = require('path');

const hooksDir = path.join(__dirname, '..', '.git', 'hooks');

if (fs.existsSync(hooksDir)) {
  const preCommitPath = path.join(hooksDir, 'pre-commit');
  const content = `#!/bin/bash

set -e

echo "Running pre-commit checks..."
npm run typecheck
npm run lint

echo "✓ All checks passed!"
exit 0
`;

  fs.writeFileSync(preCommitPath, content);
  fs.chmodSync(preCommitPath, 0o755);
  console.log('✓ Pre-commit hook installed');
}
