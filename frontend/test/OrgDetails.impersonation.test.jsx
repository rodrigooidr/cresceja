import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import OrgDetailsPage from '../src/pages/admin/OrgDetailsPage.jsx';

jest.mock('../src/api/inboxApi', () => ({
  get: jest.fn(() => Promise.resolve({ data: {} })),
  post: jest.fn(() => Promise.resolve({})),
  put: jest.fn(() => Promise.resolve({})),
}));
jest.mock('../src/hooks/useActiveOrgGate', () => () => ({ allowed: true }));

const inboxApi = require('../src/api/inboxApi');

test('adds impersonation header', async () => {
  inboxApi.get.mockResolvedValueOnce({ data: {} });
  inboxApi.get.mockResolvedValueOnce({ data: { activeMode: 'none' } });
  render(
    <MemoryRouter initialEntries={['/123?tab=whatsapp']}>
      <Routes>
        <Route path='/:id' element={<OrgDetailsPage />} />
      </Routes>
    </MemoryRouter>
  );
  await waitFor(() => {
    expect(inboxApi.get).toHaveBeenCalledWith(
      'admin/orgs/whatsapp/status',
      expect.objectContaining({
        params: { id: '123' },
        meta: expect.objectContaining({ impersonateOrgId: '123' }),
      })
    );
  });
});

