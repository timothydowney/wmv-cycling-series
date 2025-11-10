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
  coverageThreshold: {
    global: {
      branches: 47,
      functions: 47,
      lines: 47,
      statements: 47
    }
  },
  globalTeardown: '<rootDir>/src/__tests__/globalTeardown.js',
  verbose: true
};
