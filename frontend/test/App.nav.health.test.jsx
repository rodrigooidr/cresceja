// test/routes/AppRoutes.inbox.test.jsx
/* ADD-ONLY: merged & fixed */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppRoutes from '@/routes/AppRoutes';

// Mocks para isolar a navegação
jest.mock('@/components/RequirePerm.jsx', () => ({ children }) => <>{children}</>);
jest.mock('@/pages/inbox/whatsapp/WhatsAppInbox.jsx', () => () => <div>Inbox</div>);
jest.mock('@/pages/marketing/GovLogsPage.jsx', () => () => <div>Governança</div>);
jest.mock('@/pages/governanca/TelemetryPage.jsx', () => () => <div>Métricas</div>);
jest.mock('@/pages/marketing/ContentCalendar.jsx', () => () => <div>Calendário</div>);

// Polyfill opcional para ambientes sem EventSource
beforeAll(() => {
  if (typeof global.EventSource !== 'function') {
    global.EventSource = function EventSource() {};
  }
});

describe('Navegação básica', () => {
  test('abre /inbox sem crash', () => {
    render(
      <MemoryRouter initialEntries={['/inbox']}>
        <AppRoutes />
      </MemoryRouter>
    );
    // Heurísticas que devem existir na sua Inbox
    expect(screen.queryByText(/Conversas|Inbox|WhatsApp/i)).toBeTruthy();
  });
});
