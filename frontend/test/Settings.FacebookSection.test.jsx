import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import SettingsPage from '../src/pages/SettingsPage.jsx';
import inboxApi from '../src/api/inboxApi.js';

describe('SettingsPage Facebook section', () => {
  beforeEach(() => {
    inboxApi.get.mockReset();
    inboxApi.delete.mockReset();
  });

  test('renders section with add button enabled', async () => {
    inboxApi.get.mockImplementation((url) => {
      if (url.includes('/facebook/pages')) return Promise.resolve({ data: [] });
      if (url.includes('/features')) return Promise.resolve({ data: { facebook_pages: { enabled: true, limit: 1, used: 0 } } });
      return Promise.resolve({ data: {} });
    });

    render(<SettingsPage />);

    await screen.findByText(/Facebook/);
    const addBtn = await screen.findByRole('button', { name: 'Conectar página' });
    expect(addBtn).toBeEnabled();
  });

  test.each([
    { enabled: true, limit: 0, used: 0 },
    { enabled: false, limit: 1, used: 0 },
  ])('section hidden when disabled or limit=0', async (feature) => {
    inboxApi.get.mockImplementation((url) => {
      if (url.includes('/features')) return Promise.resolve({ data: { facebook_pages: feature } });
      return Promise.resolve({ data: {} });
    });
    render(<SettingsPage />);
    await waitFor(() => expect(inboxApi.get).toHaveBeenCalled());
    expect(screen.queryByText('Facebook')).not.toBeInTheDocument();
  });

  test('button disabled when limit reached', async () => {
    inboxApi.get.mockImplementation((url) => {
      if (url.includes('/facebook/pages')) return Promise.resolve({ data: [{ id: '1', page_id: 'pg1', name: 'P1', category: 'Cat', is_active: true }] });
      if (url.includes('/features')) return Promise.resolve({ data: { facebook_pages: { enabled: true, limit: 1, used: 1 } } });
      return Promise.resolve({ data: {} });
    });

    render(<SettingsPage />);

    await screen.findByText('Facebook');
    const addBtn = await screen.findByText('Adicionar outra página');
    expect(addBtn).toBeDisabled();
    expect(screen.getByText(/Limite do plano atingido/)).toBeInTheDocument();
  });

  test('removing removes page from list', async () => {
    inboxApi.get.mockImplementation((url) => {
      if (url.includes('/facebook/pages')) return Promise.resolve({ data: [{ id: 'p1', page_id: 'pg1', name: 'P1', category: 'Cat', is_active: true }] });
      if (url.includes('/features')) return Promise.resolve({ data: { facebook_pages: { enabled: true, limit: 5, used: 1 } } });
      return Promise.resolve({ data: {} });
    });
    inboxApi.delete.mockResolvedValue({});
    render(<SettingsPage />);
    await screen.findByText('Facebook');
    const removeBtn = await screen.findByRole('button', { name: 'Remover' });
    fireEvent.click(removeBtn);
    await waitFor(() => expect(inboxApi.delete).toHaveBeenCalledWith('/orgs/org_test/facebook/pages/p1', { meta: { scope: 'global' } }));
    await waitFor(() => expect(screen.queryByText('P1')).not.toBeInTheDocument());
  });
});
