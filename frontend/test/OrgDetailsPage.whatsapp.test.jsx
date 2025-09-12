import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import OrgDetailsPage from '../src/pages/admin/OrgDetailsPage.jsx';

jest.mock('../src/api/inboxApi', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));
jest.mock('../src/hooks/useActiveOrgGate', () => () => ({ allowed: true }));

const inboxApi = require('../src/api/inboxApi');

function renderPage(status) {
  inboxApi.get.mockImplementation((url) => {
    if (url.includes('/whatsapp/status')) return Promise.resolve({ data: status });
    return Promise.resolve({ data: {} });
  });
  return render(
    <MemoryRouter initialEntries={['/1?tab=whatsapp']}>
      <Routes>
        <Route path='/:orgId' element={<OrgDetailsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

test('disables Baileys connect when API active', async () => {
  renderPage({ mode: 'api', allow_baileys: true, baileys:{connected:false}, api:{connected:true} });
  const btn = await screen.findByText('Conectar Baileys');
  expect(btn).toBeDisabled();
});

test('disables API connect when Baileys active', async () => {
  renderPage({ mode: 'baileys', allow_baileys: true, baileys:{connected:true}, api:{connected:false} });
  const btn = await screen.findByText('Conectar API');
  expect(btn).toBeDisabled();
});

test('hides Baileys section when not allowed', async () => {
  renderPage({ mode: 'api', allow_baileys: false, baileys:{connected:false}, api:{connected:true} });
  await screen.findByText('API WhatsApp');
  expect(screen.queryByText('Conectar Baileys')).toBeNull();
});
