/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/test/setupTests.ts'],
  transform: {
    '^.+\\.(mjs|cjs|ts|tsx|js|jsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(msw|@mswjs|@bundled-es-modules|headers-polyfill|is-node-process|strict-event-emitter|cookie|urlpattern-polyfill|whatwg-url|fetch-blob|formdata-polyfill|web-streams-polyfill|data-urls|undici|nanoid|uuid|@reduxjs/toolkit)/)',
  ],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'json', 'node'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/'],
  collectCoverageFrom: ['src/**/*.{js,jsx,ts,tsx}', '!src/test/**']
};

