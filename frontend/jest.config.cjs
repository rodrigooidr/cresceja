/** @type {import('jest').Config} */
const config = {
  automock: false,
  testEnvironment: 'jsdom',
  testEnvironmentOptions: { url: 'http://localhost/' }, // BrowserRouter lê location
  setupFiles: ['<rootDir>/test/setup.auto-mock-inbox.cjs'],
  setupFilesAfterEnv: [
    '<rootDir>/test/setupTests.cjs',
    '<rootDir>/test/setup.jest.cjs',
  ],
  testMatch: [
    '<rootDir>/test/**/*.test.jsx',
    '<rootDir>/test/**/*.test.js',
    '<rootDir>/test/**/*.spec.jsx',
  ],
  moduleDirectories: ['node_modules', 'src'],
  moduleNameMapper: {
    '^api/(.*)$': '<rootDir>/src/api/$1',
    '^components/(.*)$': '<rootDir>/src/components/$1',
    '^pages/(.*)$': '<rootDir>/src/pages/$1',
    '^contexts/(.*)$': '<rootDir>/src/contexts/$1',
    '^hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^ui/(.*)$': '<rootDir>/src/ui/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.module\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/test/fileMock.cjs',
  },
  transform: {},
  transformIgnorePatterns: [
    '/node_modules/(?!(luxon|react-big-calendar|date-arithmetic|@internationalized/date)/)',
  ],
  testPathIgnorePatterns: ['/dist/', '/build/', '/node_modules/', '/e2e/'],
  collectCoverageFrom: [
    'src/pages/marketing/**/*.{js,jsx,ts,tsx}',
    'src/lib/{retry,idempotency,analytics}.js',
    'src/pages/marketing/hooks/useApproval.js',
  ],
  coverageThreshold: {
    './src/pages/marketing/': {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};

config.transform['^.+\\.(js|jsx)$'] = 'babel-jest';

module.exports = config;
