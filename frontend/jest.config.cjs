module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  setupFiles: ['whatwg-fetch'],
  moduleDirectories: ['node_modules', 'src'],
  moduleNameMapper: {
    '^api/(.*)$': '<rootDir>/src/api/$1',
    '^components/(.*)$': '<rootDir>/src/components/$1',
    '^pages/(.*)$': '<rootDir>/src/pages/$1',
    '^contexts/(.*)$': '<rootDir>/src/contexts/$1',
    '^hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^ui/(.*)$': '<rootDir>/src/ui/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
    '\\.(svg|png|jpg|jpeg|gif|webp|mp4|mp3)$': '<rootDir>/test/__mocks__/fileMock.js',
  },
  transform: { '^.+\\.[jt]sx?$': 'babel-jest' },
  // transpila libs ESM populares usadas no projeto
  transformIgnorePatterns: [
    '/node_modules/(?!(nanoid|@tanstack|msw)/)'
  ],
};
