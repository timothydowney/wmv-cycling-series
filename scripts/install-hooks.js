#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const dir = '.git/hooks';
if (fs.existsSync(dir)) {
  const hook = 'pre-commit';
  const content = `#!/bin/bash

# Pre-commit hook: Run linters before allowing commit
# This ensures code quality standards are met before code is committed

set -e  # Exit on first error

echo "Running pre-commit checks..."

# Run frontend linter
echo "Linting frontend code..."
npm run lint

# Run backend linter
echo "Linting backend code..."
npm run lint:backend

echo "✓ All linters passed!"
exit 0
`;
  
  const hookPath = path.join(dir, hook);
  fs.writeFileSync(hookPath, content);
  fs.chmodSync(hookPath, 0o755);
  console.log('✓ Pre-commit hook installed');
}
