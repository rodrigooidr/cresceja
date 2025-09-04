module.exports = {
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/src/test/polyfills.js'],
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  transform: { '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest' },
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/src/test/__mocks__/fileMock.js',
    '\\.(png|jpg|jpeg|gif|svg)$': '<rootDir>/src/test/__mocks__/fileMock.js',
    'socket.io-client': '<rootDir>/src/test/mocks/socket.io-client.js',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(msw|@mswjs|whatwg-url|undici|web-streams-polyfill|@bundled-es-modules|statuses)/)',
  ],
  resetMocks: true,
  clearMocks: true,
};
