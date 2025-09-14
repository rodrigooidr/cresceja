const { Settings, DateTime } = require('luxon');
process.env.TZ = 'America/Sao_Paulo';
Settings.defaultZone = 'America/Sao_Paulo';
const fixedNow = DateTime.fromISO('2025-10-01T12:00:00-03:00', { setZone: true }).toMillis();
Settings.now = () => fixedNow;

// jest-dom
require('@testing-library/jest-dom');

// Polyfills comuns em JSDOM
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => jest.fn(),
  };
});

jest.mock('../src/api');
jest.mock('../src/api/inboxApi.js');
jest.mock('../src/ui/feature/FeatureGate.jsx', () => ({
  __esModule: true,
  default: ({ children }) => children,
}));
jest.mock('../src/ui/feature/FeatureGate', () => ({
  __esModule: true,
  default: ({ children }) => children,
}));

jest.mock('../src/contexts/AuthContext', () => {
  const React = require('react');
  const AuthContext = React.createContext({
    user: { id: 'u_test', role: 'SuperAdmin', email: 'test@x.com' },
    isAuthenticated: true,
    login: jest.fn(),
    logout: jest.fn(),
    loading: false,
  });
  const useAuth = () => React.useContext(AuthContext);
  return { __esModule: true, AuthContext, useAuth };
});

// Mock do contexto de organizações para os testes
jest.mock('../src/contexts/OrgContext.jsx', () => {
  const React = require('react');
  return {
    __esModule: true,
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

jest.mock(
  'react-hot-toast',
  () => ({
    __esModule: true,
    default: { success: jest.fn(), error: jest.fn() },
    toast: { success: jest.fn(), error: jest.fn() },
  }),
  { virtual: true }
);

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

jest.useFakeTimers();
afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});
