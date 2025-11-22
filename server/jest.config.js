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
        }
      }
    ]
  },
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',  // Only TypeScript files
    '!src/**/*.test.ts',
    '!src/__tests__/**'
  ],
  testMatch: [
    '**/__tests__/**/*.test.{js,ts}'
  ],
  testPathIgnorePatterns: [
    '/__tests__/.*\\.test\\.js$'  // Ignore .js test files (use .ts instead)
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
