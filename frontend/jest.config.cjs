module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/test/setupTests.ts'],
  moduleNameMapper: {
    '^api/(.*)$': '<rootDir>/src/api/$1',
    '^inbox/(.*)$': '<rootDir>/src/inbox/$1',
    '^components/(.*)$': '<rootDir>/src/components/$1',
    '^ui/(.*)$': '<rootDir>/src/ui/$1',
    '\\.(png|jpe?g|gif|svg)$': '<rootDir>/src/test/fileMock.js',
    '\\.(css|scss)$': 'identity-obj-proxy',
  },
  testEnvironmentOptions: {
    url: 'http://localhost/',
  },
};
