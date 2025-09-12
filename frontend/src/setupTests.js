// src/setupTests.js
import '@testing-library/jest-dom';
import 'whatwg-fetch';
import React from 'react';

// ------- Browser shims -------
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((q) => ({
      matches: false,
      media: q,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = global.ResizeObserver || ResizeObserver;

class IntersectionObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.IntersectionObserver = window.IntersectionObserver || IntersectionObserverMock;

window.scrollTo = window.scrollTo || jest.fn();
if (typeof HTMLElement !== 'undefined') {
  HTMLElement.prototype.scrollIntoView = HTMLElement.prototype.scrollIntoView || jest.fn();
}

URL.createObjectURL = URL.createObjectURL || jest.fn();

// crypto (getRandomValues/subtle)
try {
  const { webcrypto } = require('crypto');
  if (!global.crypto) global.crypto = webcrypto;
} catch { /* noop */ }

// navigator.clipboard
if (!navigator.clipboard) {
  navigator.clipboard = { writeText: jest.fn().mockResolvedValue(undefined) };
}

// ------- Router: usa MemoryRouter nos testes mesmo que a app use BrowserRouter -------
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  const { MemoryRouter } = actual;
  function BrowserRouterMock({ children, ...props }) {
    return (
      <MemoryRouter initialEntries={['/']} {...props}>
        {children}
      </MemoryRouter>
    );
  }
  return { ...actual, BrowserRouter: BrowserRouterMock };
});

// ------- Gates/Contexts (use caminhos relativos ao próprio src/) -------
jest.mock('./hooks/useActiveOrgGate', () => ({
  __esModule: true,
  default: () => ({ allowed: true, reason: null }),
}));

jest.mock('./contexts/OrgContext', () => ({
  __esModule: true,
  useOrg: () => ({ org: { id: 'test-org', name: 'Test Org' }, setSelected: jest.fn(), loading: false }),
  OrgProvider: ({ children }) => <>{children}</>,
}));

jest.mock('./contexts/AuthContext', () => ({
  __esModule: true,
  useAuth: () => ({ user: { id: 'u1', role: 'SuperAdmin' }, token: 't', logout: jest.fn(), isAuthenticated: true }),
  AuthProvider: ({ children }) => <>{children}</>,
}));

jest.mock('./contexts/TrialContext', () => ({
  __esModule: true,
  useTrial: () => ({ trialDays: 14 }),
  TrialProvider: ({ children }) => <>{children}</>,
}));

// ------- React Query (mock virtual: pacote pode nem existir) -------
jest.mock('@tanstack/react-query', () => {
  const React = require('react');
  const stubUseQuery = jest.fn(() => ({
    data: undefined,
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: jest.fn(),
    status: 'success',
  }));
  const stubUseMutation = jest.fn(() => ({
    mutate: jest.fn(),
    isLoading: false,
    error: null,
    status: 'idle',
  }));

  return {
    // componentes/hooks usados nos testes
    QueryClientProvider: ({ children }) => React.createElement(React.Fragment, null, children),
    useQuery: stubUseQuery,
    useMutation: stubUseMutation,

    // símbolos comuns que alguns arquivos importam
    QueryClient: function QueryClient() {},
    dehydrate: () => ({}),
    Hydrate: ({ children }) => React.createElement(React.Fragment, null, children),
  };
}, { virtual: true });

// ------- HTTP client: fixtures úteis (use caminho relativo) -------
jest.mock('./api/inboxApi', () => {
  const ok = (data) => Promise.resolve({ data });

  // Inbox fixtures com "Alice"
  const THREADS = {
    items: [
      {
        id: 't1',
        org_id: 'test-org',
        contact: { id: 'c1', name: 'Alice', handle: 'alice', avatar_url: null },
        last_message: { id: 'm1', text: 'Olá', created_at: '2025-01-01T00:00:00Z' },
        unread_count: 0,
      },
    ],
  };

  return {
    __esModule: true,
    default: {
      get: jest.fn((url) => {
        // Inbox
        if (url.includes('/inbox/threads'))   return ok(THREADS);
        if (url.includes('/inbox/messages'))  return ok({ items: [] });
        if (url.includes('/contacts'))        return ok({ items: THREADS.items.map(t => t.contact) });

        // Admin/Plans + público
        if (url.includes('/admin/plans'))     return ok({ plans: [], feature_defs: [], plan_features: [] });
        if (url.includes('/public/plans'))    return ok({ items: [] });

        // Orgs
        if (url.includes('/admin/orgs'))      return ok({ orgs: [{ id: 'org-1', name: 'CresceJá' }, { id: 'org-2', name: 'CresceJá Demo' }] });
        if (url.match(/\/admin\/orgs\/[^/]+$/)) return ok({ org: { id: 'org-1', name: 'CresceJá', status: 'active' }, payments: [], purchases: [] });

        // Google Calendar
        if (url.includes('/integrations/google-calendar/status')) return ok({ status: 'disconnected', config: null });

        return ok({});
      }),
      post: jest.fn((url) => {
        if (url.includes('/integrations/google-calendar/')) return ok({ ok: true });
        return ok({ ok: true });
      }),
      put:  jest.fn(() => ok({ ok: true })),
      delete: jest.fn(() => ok({ ok: true })),
      defaults: { headers: { common: {} } },
      interceptors: { request: { use: () => {} }, response: { use: () => {} } },
    },
    setActiveOrg: () => {},
  };
});
