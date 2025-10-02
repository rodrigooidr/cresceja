/** @type {import('jest').Config} */
const config = {
  automock: false,
  rootDir: __dirname, // isola o root no diretório do frontend
  testEnvironment: 'jsdom',
  setupFiles: [
    '<rootDir>/test/setup.early.cjs',
    '<rootDir>/test/setup.auto-mock-inbox.cjs',
  ],
  setupFilesAfterEnv: [
    '<rootDir>/test/msw.node.mock.cjs',
    '<rootDir>/test/setup.after.cjs',
    '<rootDir>/test/setupTests.cjs',
    '<rootDir>/test/setup.jest.cjs',
  ],
  testEnvironmentOptions: {
    url: 'http://localhost/', // BrowserRouter lê location
    customExportConditions: ['node', 'node-addons'],
  },
  testMatch: [
    '<rootDir>/test/**/*.(test|spec).(js|jsx|ts|tsx)', // só pega testes do frontend
  ],
  moduleDirectories: ['node_modules', '<rootDir>/src', '<rootDir>/test'],
  moduleNameMapper: {
    '^api/(.*)$': '<rootDir>/src/api/$1',
    '^components/(.*)$': '<rootDir>/src/components/$1',
    '^pages/(.*)$': '<rootDir>/src/pages/$1',
    '^contexts/(.*)$': '<rootDir>/src/contexts/$1',
    '^hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^ui/(.*)$': '<rootDir>/src/ui/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^msw$': '<rootDir>/test/msw.mock.cjs',
    '^msw/node$': '<rootDir>/test/msw.node.mock.cjs',
    '\\.(css|less|scss|sass)$': '<rootDir>/test/styleMock.cjs',
    '\\.(png|jpg|jpeg|gif|svg|webp|mp4|mp3|wav)$': '<rootDir>/test/fileMock.cjs',
  },
  transform: {},
  transformIgnorePatterns: [
    '/node_modules/(?!nanoid|uuid|@?react-.*|@?reduxjs|lodash-es|luxon|react-big-calendar|date-arithmetic|@internationalized/date)/',
  ],
  testPathIgnorePatterns: [
    '/dist/',
    '/build/',
    '/node_modules/',
    '/e2e/',
    '<rootDir>/../backend/', // ignora backend
    '<rootDir>/../server/',
    '<rootDir>/../test/', // caso exista um "test" na raiz do repo
  ],
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
  fakeTimers: { enableGlobally: true, legacyFakeTimers: false },
};

config.transform['^.+\\\.(js|jsx)$'] = 'babel-jest';

module.exports = config;
