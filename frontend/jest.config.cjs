module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  transform: { '^.+\\.[jt]sx?$': 'babel-jest' },
  moduleFileExtensions: ['js', 'jsx', 'json'],
  testPathIgnorePatterns: ['/node_modules/', '/backend/'],
  moduleNameMapper: { '^.+\\.(css|scss|sass|less)$': 'identity-obj-proxy' },
  transformIgnorePatterns: ['/node_modules/(?!(lucide-react|msw|@mswjs|axios|nanoid|uuid|@bundled-es-modules|tough-cookie|whatwg-url|formdata-polyfill|fetch-blob|undici)/)'],
};
