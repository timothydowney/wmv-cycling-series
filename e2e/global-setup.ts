import { execSync } from 'child_process';

const root = process.cwd();

export default async function globalSetup(): Promise<void> {
  // Bootstrap the E2E database (Docker postgres up, schema, seed).
  // TODO: rewrite as TypeScript — https://github.com/timothydowney/wmv-cycling-series/issues
  execSync('bash scripts/ensure-e2e-db.sh', { cwd: root, stdio: 'inherit' });
}
