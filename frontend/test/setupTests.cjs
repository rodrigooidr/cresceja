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

class MockIntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.IntersectionObserver = MockIntersectionObserver;
