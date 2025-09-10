/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleDirectories: ['node_modules', 'src'],
  moduleNameMapper: {
    '^api/(.*)$': '<rootDir>/src/api/$1',
    '^inbox/(.*)$': '<rootDir>/src/inbox/$1',
    '^components/(.*)$': '<rootDir>/src/components/$1',
    '^pages/(.*)$': '<rootDir>/src/pages/$1',
    '^ui/(.*)$': '<rootDir>/src/ui/$1',
    '^hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^auth/(.*)$': '<rootDir>/src/auth/$1',
    '^assets/(.*)$': '<rootDir>/src/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
    '\\.(svg|png|jpg|jpeg|gif|webp|mp4|mp3)$': '<rootDir>/test/__mocks__/fileMock.js',
    '^@bundled-es-modules/statuses$': '<rootDir>/src/test/shims/statuses.cjs',
    '^statuses$': '<rootDir>/src/test/shims/statuses.cjs',
  },
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(msw|@mswjs|@bundled-es-modules|headers-polyfill|is-node-process|strict-event-emitter|cookie|urlpattern-polyfill|whatwg-url|fetch-blob|formdata-polyfill|web-streams-polyfill|data-urls|undici|nanoid|uuid|@reduxjs/toolkit)/)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/'],
  setupFiles: ['whatwg-fetch'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'json', 'node'],
  collectCoverageFrom: ['src/**/*.{js,jsx,ts,tsx}', '!src/test/**'],
};

