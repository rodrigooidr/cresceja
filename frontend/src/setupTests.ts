import '@testing-library/jest-dom';
import 'whatwg-fetch';
import React from 'react';

// ------- Browser shims -------
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((q) => ({
    matches: false, media: q, onchange: null,
    addListener: jest.fn(), removeListener: jest.fn(),
    addEventListener: jest.fn(), removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

class ResizeObserver { observe(){} unobserve(){} disconnect(){} }
(global as any).ResizeObserver = ResizeObserver;

class IO { observe(){} unobserve(){} disconnect(){} }
;(window as any).IntersectionObserver = IO as any;

;(window as any).scrollTo = jest.fn();
;(HTMLElement as any).prototype.scrollIntoView = jest.fn();

URL.createObjectURL = URL.createObjectURL || jest.fn();

// crypto (getRandomValues/subtle)
try {
  const { webcrypto } = require('crypto');
  if (!global.crypto) (global as any).crypto = webcrypto;
} catch { /* noop */ }

// navigator.clipboard
if (!(navigator as any).clipboard) {
  (navigator as any).clipboard = { writeText: jest.fn().mockResolvedValue(void 0) };
}

// ------- Router: usa MemoryRouter nos testes mesmo se o app usar BrowserRouter -------
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  const MemoryRouter = actual.MemoryRouter;
  return {
    ...actual,
    BrowserRouter: ({ children, ...props }: any) => (
      <MemoryRouter initialEntries={['/']} {...props}>{children}</MemoryRouter>
    ),
  };
});

// ------- Gates/Contexts -------
jest.mock('hooks/useActiveOrgGate', () => ({
  __esModule: true,
  default: () => ({ allowed: true, reason: null }),
}));

jest.mock('contexts/OrgContext', () => ({
  __esModule: true,
  useOrg: () => ({ org: { id: 'test-org', name: 'Test Org' }, setOrg: jest.fn(), isLoading: false }),
  OrgProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('contexts/AuthContext', () => ({
  __esModule: true,
  useAuth: () => ({ user: { id: 'u1', role: 'SuperAdmin' }, token: 't', signOut: jest.fn() }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('contexts/TrialContext', () => ({
  __esModule: true,
  useTrial: () => ({ trialDays: 14 }),
  TrialProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ------- React Query (simplificado p/ não exigir Provider em todo teste) -------
jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  return {
    ...actual,
    QueryClientProvider: ({ children }: any) => <>{children}</>,
    useQuery: jest.fn().mockImplementation(() => ({
      data: undefined, isLoading: false, isFetching: false, error: null, refetch: jest.fn(), status: 'success'
    })),
    useMutation: jest.fn().mockImplementation(() => ({
      mutate: jest.fn(), isLoading: false, error: null, status: 'idle'
    })),
  };
});

// ------- HTTP client: fixtures úteis -------
jest.mock('api/inboxApi', () => {
  const ok = (data: any) => Promise.resolve({ data });

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
      get: jest.fn((url: string) => {
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
      post: jest.fn((url: string) => {
        if (url.includes('/integrations/google-calendar/')) return ok({ ok: true });
        return ok({ ok: true });
      }),
      put:  jest.fn(() => ok({ ok: true })),
      delete: jest.fn(() => ok({ ok: true })),
    },
  };
});

// Se algum teste precisar do comportamento real de React Query ou de um endpoint, você pode desfazer o mock dentro do teste específico com jest.unmock(...) e/ou sobrescrever inboxApi.get naquele teste.
