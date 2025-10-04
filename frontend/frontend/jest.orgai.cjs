/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  testEnvironmentOptions: { url: 'http://localhost/' },

  // Carrega apenas os setups leves (sem o setupTests.cjs legado de timers)
  setupFiles: [
    '<rootDir>/test/setup.early.cjs',            // mocks iniciais (inboxApi + augment V3)
  ],
  setupFilesAfterEnv: [
    '<rootDir>/test/setup.jest.cjs',             // polyfills, portal-root, etc.
  ],

  // 🔎 Somente arquivos de teste da feature "IA da Organização"
  testMatch: [
    '<rootDir>/test/OrgAIPage.*.(test|spec).jsx',
    '<rootDir>/test/OrgAIPage.header.*.(test|spec).jsx',
    '<rootDir>/test/OrgAIPage.render.*.(test|spec).jsx',
    '<rootDir>/test/OrgAIPage.save.*.(test|spec).jsx',
    '<rootDir>/test/RouteGuard.ai.settings.*.(test|spec).jsx',
    '<rootDir>/test/Sidebar.orgAi.perms.*.(test|spec).jsx',
    '<rootDir>/test/GuardrailsForm.*.(test|spec).jsx',
    '<rootDir>/test/RagSourcesCard.*.(test|spec).jsx',
    '<rootDir>/test/PromptPreview.*.(test|spec).jsx',
    '<rootDir>/test/TestChat.*.(test|spec).jsx',
    '<rootDir>/test/ViolationsList.*.(test|spec).jsx',
  ],

  moduleDirectories: ['node_modules', 'src'],
  moduleNameMapper: {
    '^api/(.*)$': '<rootDir>/src/api/$1',
    '^components/(.*)$': '<rootDir>/src/components/$1',
    '^pages/(.*)$': '<rootDir>/src/pages/$1',
    '^contexts/(.*)$': '<rootDir>/src/contexts/$1',
    '^hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^ui/(.*)$': '<rootDir>/src/ui/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.module\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/test/fileMock.cjs',
  },

  transform: {},
  transformIgnorePatterns: [
    '/node_modules/(?!(luxon|react-big-calendar|date-arithmetic|@internationalized/date)/)',
  ],

  // NÃO habilitar fakeTimers globalmente aqui para evitar conflito com suites legadas
  // fakeTimers: { enableGlobally: false },
};

config.transform['^.+\\\.(js|jsx)$'] = 'babel-jest';

module.exports = config;
