require('@testing-library/jest-dom');

// TZ e Luxon
process.env.TZ = 'America/Sao_Paulo';
try {
  const { Settings } = require('luxon');
  Settings.defaultZone = 'America/Sao_Paulo';
} catch {}

// Polyfills comuns em JSDOM
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

jest.mock('../src/api/inboxApi.js', () => {
  const mock = {
    get: jest.fn(() => Promise.resolve({ data: { items: [] } })),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    defaults: {},
  };
  return { __esModule: true, default: mock };
});

jest.mock('../src/contexts/AuthContext', () => {
  return {
    useAuth: () => ({
      user: { id: 'u_test', role: 'SuperAdmin', email: 'test@x.com' },
      isAuthenticated: true,
      login: jest.fn(),
      logout: jest.fn(),
    }),
    AuthProvider: ({ children }) => children,
  };
});

jest.mock('../src/auth/useAuth.js', () => ({
  useAuth: () => ({ user: { permissions: ['CAN_MANAGE_CAMPAIGNS'] } })
}));

// Mock do contexto de organizações para os testes
jest.mock('../src/contexts/OrgContext.jsx', () => {
  const React = require('react');
  return {
    useOrg: () => ({
      orgs: [{ id: 'org_test', name: 'Org Teste' }],
      selected: 'org_test', // padrão: há uma org ativa
      setSelected: jest.fn(),
      loading: false,
      hasMore: false,
      searchOrgs: jest.fn(),
      loadMoreOrgs: jest.fn(),
      canSeeSelector: true,
      q: '',
      publicMode: false,
      hasActive: true,
      activeOrgName: 'Org Teste',
    }),
    OrgContext: React.createContext(null),
    OrgProvider: ({ children }) => children,
  };
});

// Polyfills que costumam faltar
class MockIntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.IntersectionObserver = MockIntersectionObserver;

if (!global.ResizeObserver) {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!global.window.matchMedia) {
  global.window.matchMedia = () => ({
    matches: false,
    media: '',
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return false; },
  });
}

if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = function () {};
}
