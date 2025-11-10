# Pre-Commit Checklist

Before committing or pushing code, run these checks to ensure code quality and catch issues early.

## Quick Check (All-in-One)

```bash
npm run check
```

This runs all checks in sequence:
1. ✅ **Audit dependencies** - Checks for security vulnerabilities
2. ✅ **Typecheck** - TypeScript type checking on frontend
3. ✅ **Lint frontend** - ESLint on React/TypeScript code
4. ✅ **Lint backend** - ESLint on Node.js code
5. ✅ **Build** - Builds both frontend and backend
6. ✅ **Test** - Runs full test suite with coverage

## Individual Checks

If you want to run specific checks:

### Dependencies
```bash
npm audit                  # Check both frontend and backend
npm audit:fix             # Auto-fix vulnerabilities (if safe)
```

### Type Checking
```bash
npm run typecheck         # Frontend TypeScript only
```

### Linting
```bash
npm run lint              # Check both frontend and backend
npm run lint:fix          # Auto-fix linting issues
```

**Frontend only:**
```bash
eslint src --ext ts,tsx
```

**Backend only:**
```bash
cd server && npm run lint
cd server && npm run lint:fix
```

### Building
```bash
npm run build             # Build both frontend and backend
npm run build:server      # Backend only
npm run dev               # Frontend only (with hot reload)
```

### Testing
```bash
npm test                  # Full test suite with coverage
cd server && npm run test:watch  # Backend tests in watch mode
```

## Workflow Examples

### Before committing code:
```bash
npm run check
```

### If checks fail:
1. **Audit failures** → Run `npm audit:fix` (review what changed)
2. **Type errors** → Fix TypeScript issues manually
3. **Lint failures** → Run `npm run lint:fix` (auto-fixes most issues)
4. **Build failures** → Check console output for detailed errors
5. **Test failures** → Review test output and fix code or tests

### Quick iteration during development:
```bash
# Terminal 1: Run dev servers
npm run dev:all

# Terminal 2: Run tests in watch mode
cd server && npm run test:watch

# Terminal 3: Run linting in watch mode (if available)
# or periodically run npm run check
```

## CI/CD Integration

These same checks run automatically in GitHub Actions on every push and pull request. The CI workflow:

1. Audits both frontend and backend dependencies
2. Typechecks frontend
3. Lints both frontend and backend
4. Builds the application
5. Runs all tests

If CI fails, fix the issues locally using the commands above, then push again.

## ESLint Rules

### Backend Rules (Node.js, CommonJS)
- Consistent 2-space indentation
- Single quotes for strings
- Semicolons required
- No unused variables (except prefixed with `_`)
- Prefer `const` over `let` or `var`
- Strict equality (`===`, `!==`)
- No `var` keyword (use `const` or `let`)
- Console.warn/error allowed, but console.log discouraged in production code

### Frontend Rules (React, TypeScript)
- Inherited from ESLint plugin recommendations
- React hooks rules enforced
- JSX formatting rules

## Tips

- **Fix early**: Don't let linting/type errors accumulate
- **Use auto-fix**: `npm run lint:fix` fixes most issues automatically
- **Review audit output**: Not all audit warnings are critical; review before updating
- **Run before push**: Always run `npm run check` before pushing to avoid CI failures
