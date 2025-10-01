export default {
  testEnvironment: 'node',
  transform: {},
  moduleFileExtensions: ['js', 'mjs', 'cjs', 'json'],
  setupFiles: ['dotenv/config'],
  roots: ['<rootDir>/test'],
  testMatch: ['**/?(*.)+(spec|test).mjs'],
};
