import React from 'react';
import { render, screen } from '@testing-library/react';
import AppRoutes from '@/routes/AppRoutes.jsx';

jest.mock('@/components/RequirePerm.jsx', () => ({ children }) => <>{children}</>);
jest.mock('@/pages/inbox/whatsapp/WhatsAppInbox.jsx', () => () => <div>Inbox</div>);
jest.mock('@/pages/marketing/GovLogsPage.jsx', () => () => <div>Governança</div>);
jest.mock('@/pages/governanca/TelemetryPage.jsx', () => () => <div>Métricas</div>);
jest.mock('@/pages/marketing/ContentCalendar.jsx', () => () => <div>Calendário</div>);

const routes = Array.isArray(AppRoutes) ? AppRoutes : AppRoutes.routes;

const inboxRoute = routes.find((route) => route.path === '/inbox');

test('abre Inbox sem crash', () => {
  expect(inboxRoute).toBeTruthy();
  render(inboxRoute.element);
  expect(screen.getByText(/Conversas|Inbox|WhatsApp/i)).toBeTruthy();
});
