/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  testEnvironmentOptions: { url: 'http://localhost/' }, // BrowserRouter lê location
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
    '\\.(css|less|sass|scss)$': '<rootDir>/test/styleMock.cjs',
    '\\.module\\.(css|less|sass|scss)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/test/fileMock.cjs',
  },
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
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
