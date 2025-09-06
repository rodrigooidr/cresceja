module.exports = {
  testEnvironment: 'jsdom',
  testEnvironmentOptions: { url: 'http://localhost/' },
  setupFiles: ['<rootDir>/src/test/polyfills.js'],
  setupFilesAfterEnv: ['<rootDir>/src/test/setupTests.ts'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  moduleNameMapper: {
    '^socket\\.io-client$': '<rootDir>/src/test/mocks/socket.io-client.js',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/sockets/socket$': '<rootDir>/src/test/mocks/app-socket.js',
    '^axios$': '<rootDir>/src/test/mocks/axios.js',
    '^api/(.*)$': '<rootDir>/src/api/$1',
    '^inbox/(.*)$': '<rootDir>/src/inbox/$1',
    '^ui/(.*)$': '<rootDir>/src/ui/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(png|jpg|jpeg|gif|svg)$': '<rootDir>/src/test/__mocks__/fileMock.js',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(msw|@mswjs|whatwg-url|undici|web-streams-polyfill|@bundled-es-modules|statuses|axios)/)',
  ],
  resetMocks: true,
  clearMocks: true,
  extensionsToTreatAsEsm: ['.jsx', '.ts', '.tsx'],
};
