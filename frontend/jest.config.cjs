module.exports = {
  testEnvironment: 'jsdom',
  testEnvironmentOptions: { url: 'http://localhost/' },
  setupFiles: ['<rootDir>/src/test/polyfills.js'],
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  transform: { '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest' },
  moduleNameMapper: {
    '^socket\\.io-client$': '<rootDir>/src/test/mocks/socket.io-client.js',
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': '<rootDir>/src/test/__mocks__/fileMock.js',
    '\\.(png|jpg|jpeg|gif|svg)$': '<rootDir>/src/test/__mocks__/fileMock.js',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(msw|@mswjs|whatwg-url|undici|web-streams-polyfill|@bundled-es-modules|statuses)/)',
  ],
  resetMocks: true,
  clearMocks: true,
  extensionsToTreatAsEsm: ['.jsx', '.ts', '.tsx'],
};
