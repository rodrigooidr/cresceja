import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import Sidebar from '@/components/Sidebar.jsx';

jest.mock('@/auth/permCompat', () => ({
  hasPerm: (p) => ({
    'inbox:view': true,
    'audit:view': false,
    'telemetry:view': false,
    'marketing:view': true,
  }[p] ?? false),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'Manager', features: {} }, logout: jest.fn() }),
}));

jest.mock('@/config/sidebar', () => []);

jest.mock('@/components/WorkspaceSwitcher', () => () => <div data-testid="workspace-switcher" />);

jest.mock('@/api/inboxApi', () => ({
  get: jest.fn(() => Promise.resolve({ data: { role: 'Agent' } })),
}));

test('sidebar exibe links conforme permissão', async () => {
  render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>
  );

  expect(await screen.findByText('Inbox')).toBeInTheDocument();
  expect(screen.getByText('Calendário')).toBeInTheDocument();
  expect(screen.queryByText(/Governança/i)).toBeNull();
  expect(screen.queryByText(/Métricas/i)).toBeNull();
});
