require('@testing-library/jest-dom');

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
global.ResizeObserver = global.ResizeObserver ||
  class { observe() {} unobserve() {} disconnect() {} };

class MockIntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.IntersectionObserver = MockIntersectionObserver;

// matchMedia polyfill para jsdom
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),             // legacy
      removeListener: jest.fn(),          // legacy
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}
