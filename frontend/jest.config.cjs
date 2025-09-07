module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/test/setupTests.ts'],
  moduleNameMapper: {
    '^api/(.*)$': '<rootDir>/src/api/$1',
    '^inbox/(.*)$': '<rootDir>/src/inbox/$1',
    '^components/(.*)$': '<rootDir>/src/components/$1',
    '^ui/(.*)$': '<rootDir>/src/ui/$1',
    '\\.(css|scss)$': 'identity-obj-proxy',
  },
};
