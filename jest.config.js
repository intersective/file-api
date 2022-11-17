module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  coverageReporters: ['lcov','text', 'html'],
  testResultsProcessor: 'jest-sonar-reporter',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/index.ts',
    '!src/utils.ts',
    '!src/data-sources/*.ts'
  ],
  coverageDirectory: 'coverage/'
};
