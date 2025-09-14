/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/test/setupTests.cjs'],
  testMatch: ['<rootDir>/test/**/*.test.jsx', '<rootDir>/test/**/*.test.js'],
  moduleDirectories: ['node_modules', 'src'],
  moduleNameMapper: {
    '^api/(.*)$': '<rootDir>/src/api/$1',
    '^components/(.*)$': '<rootDir>/src/components/$1',
    '^pages/(.*)$': '<rootDir>/src/pages/$1',
    '^contexts/(.*)$': '<rootDir>/src/contexts/$1',
    '^hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^ui/(.*)$': '<rootDir>/src/ui/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|sass|scss)$': '<rootDir>/test/__mocks__/styleMock.js',
    '\\.(svg|png|jpg|jpeg|gif|webp|mp4|mp3)$': '<rootDir>/test/__mocks__/fileMock.js',
  },
  transform: { '^.+\\.[jt]sx?$': 'babel-jest' },
  // ⚠️ Permite transformar pacotes ESM usados no front
  transformIgnorePatterns: [
    '/node_modules/(?!(luxon|react-big-calendar|date-arithmetic|@internationalized/date|@testing-library|nanoid)/)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/', '/e2e/'],
};
