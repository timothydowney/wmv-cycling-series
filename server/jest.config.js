module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/__tests__/**'
  ],
  testMatch: [
    '**/__tests__/**/*.test.js'
  ],
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
  globalTeardown: '<rootDir>/src/__tests__/globalTeardown.js',
  verbose: true
};
