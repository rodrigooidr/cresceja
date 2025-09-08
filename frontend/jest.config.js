/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/test/setupTests.ts'],

  // Transpila TS/JS/JSX/TSX e também .mjs/.cjs via babel-jest
  transform: {
    '^.+\\.(mjs|cjs|ts|tsx|js|jsx)$': 'babel-jest',
  },

  // Não ignore estes módulos ESM em node_modules (deixe o Babel transpilar)
  // Se outro pacote acusar erro "Unexpected token 'export'", inclua-o aqui.
  transformIgnorePatterns: [
    '/node_modules/(?!(msw|@mswjs|@bundled-es-modules|headers-polyfill|is-node-process|strict-event-emitter|cookie|urlpattern-polyfill|whatwg-url|fetch-blob|formdata-polyfill|web-streams-polyfill|data-urls|undici|nanoid|uuid|@reduxjs/toolkit)/)',
  ],

  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Ajuda o resolver do Jest a lidar com ESM
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'json', 'node'],
  extensionsToTreatAsEsm: ['.mjs'],

  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/'],
  collectCoverageFrom: ['src/**/*.{js,jsx,ts,tsx}', '!src/test/**'],
};
