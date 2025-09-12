module.exports = {
  moduleNameMapper: {
    '^#db$': '<rootDir>/config/db.js',
    '^#redis$': '<rootDir>/config/redis.js'
  },
  testMatch: ['**/?(*.)+(spec|test).+(js|cjs)']
}
