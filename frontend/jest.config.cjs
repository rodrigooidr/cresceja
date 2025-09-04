module.exports = {
  testEnvironment: 'jsdom',
  transform: { '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest' },
  setupFiles: ['<rootDir>/src/test/polyfills.js'],
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/src/test/__mocks__/fileMock.js',
    '\\.(png|jpg|jpeg|gif|svg)$': '<rootDir>/src/test/__mocks__/fileMock.js',
  },
  transformIgnorePatterns: [
    // garante que msw/whatwg não quebrem por ESM
    '/node_modules/(?!(msw|@mswjs|whatwg-url|undici|web-streams-polyfill|@bundled-es-modules|statuses)/)',
  ],
};
