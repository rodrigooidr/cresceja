/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/test/setupTests.ts'],
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
  },
  // transpilar dependências ESM usadas nos testes (MSW e cia)
  transformIgnorePatterns: [
    '/node_modules/(?!(msw|@mswjs|nanoid|uuid|@reduxjs/toolkit|@bundled-es-modules)/)',
  ],
  moduleNameMapper: {
    // CSS modules
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    // alias
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  moduleDirectories: ['node_modules', '<rootDir>/src'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/'],
  collectCoverageFrom: ['src/**/*.{js,jsx,ts,tsx}', '!src/test/**'],
};
