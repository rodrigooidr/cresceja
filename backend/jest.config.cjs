module.exports = {
  testEnvironment: 'node',
  moduleNameMapper: {
    '^#db$': '<rootDir>/db/index.js',
    '^#redis$': '<rootDir>/config/redis.js'
  },
  transform: {},
  setupFiles: ['<rootDir>/test/setup.env.cjs'],
  testMatch: ['**/?(*.)+(spec|test).+(js|cjs)']
};
