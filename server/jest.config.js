module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'esnext',
          types: ['jest', 'node']
        },
        diagnostics: {
          ignoreCodes: [6133, 6196, 2307] // Ignore unused declarations and cannot find module errors
        }
      }
    ]
  },
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',  // Only TypeScript files
    'src/db/schema.ts', // Include Drizzle schema for coverage and type resolution
    '!src/**/*.test.ts',
    '!src/__tests__/**'
  ],
  testMatch: [
    '**/__tests__/**/*.test.{js,ts}'
  ],
  testPathIgnorePatterns: [
    '/__tests__/.*\\.test\\.js$',  // Ignore .js test files (use .ts instead)
    '/server/src/index\\.ts$', // Prevents duplicate app init errors
    '/server/src/db\\.ts$', // Prevents db init re-execution
    '/server/src/db/schema\\.ts$', // Not a test file
    '/server/src/config\\.ts$', // Not a test file
    '/server/src/types/database\\.ts$', // Not a test file (it was deleted, but just to be safe)
    '/server/src/routes/seasons\\.ts$' // Not a test file
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  // Coverage thresholds intentionally set below current levels while
  // backend expansion is in progress. Raise these as implementation grows.
  coverageThreshold: {
    global: {
      branches: 40,
      functions: 40,
      lines: 40,
      statements: 40
    }
  },
  globalTeardown: '<rootDir>/src/__tests__/globalTeardown.ts',
  verbose: true
};
