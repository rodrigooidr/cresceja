import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('../sockets/socket', () => ({
  makeSocket: () => ({ on: jest.fn(), close: jest.fn(), disconnect: jest.fn() }),
}));

jest.mock('../api/inboxApi', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
  apiUrl: (x) => x,
}));

import InboxPage from '../pages/inbox/InboxPage.jsx';
import inboxApi from '../api/inboxApi';

describe('contact inline edit', () => {
  beforeEach(() => {
    inboxApi.get.mockImplementation((url) => {
      if (url === '/tags' || url === '/crm/statuses') return Promise.resolve({ data: { items: [] } });
      if (url === '/quick-replies') return Promise.resolve({ data: { items: [] } });
      if (url === '/inbox/conversations' || url === '/conversations') {
        return Promise.resolve({ data: { items: [ { id: 1, contact: { id: 'c1', name: 'Alice', phone_e164: '+5511999999999', email: 'a@example.com' } } ] } });
      }
      if (url.includes('/messages')) return Promise.resolve({ data: { items: [] } });
      return Promise.resolve({ data: {} });
    });
    inboxApi.post.mockResolvedValue({ data: {} });
    inboxApi.put.mockResolvedValue({ data: { client: { id: 'c1', name: 'Alice', phone_e164: '+5511999999999', email: 'a@example.com' } } });
  });
  afterEach(() => { jest.clearAllMocks(); });

  async function setup() {
    await act(async () => {
      render(
        <MemoryRouter>
          <InboxPage />
        </MemoryRouter>
      );
    });
    const btn = await screen.findByTestId('conv-item');
    await act(async () => { fireEvent.click(btn); });
    await screen.findByTestId('composer-text');
  }

  it('validates and saves', async () => {
    await setup();
    const name = screen.getByTestId('contact-name');
    fireEvent.change(name, { target: { value: '' } });
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('contact-save-status').textContent).toBe('');
    fireEvent.change(name, { target: { value: 'Alice A' } });
    await new Promise((r) => setTimeout(r, 700));
    await waitFor(() => expect(inboxApi.put).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('contact-save-status').textContent).toContain('salvo'));
  });

  it('rollback on error', async () => {
    inboxApi.put.mockRejectedValueOnce(new Error('fail'));
    await setup();
    const name = screen.getByTestId('contact-name');
    fireEvent.change(name, { target: { value: 'Bob' } });
    await new Promise((r) => setTimeout(r, 700));
    await waitFor(() => expect(inboxApi.put).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('contact-save-status').textContent).toContain('erro'));
    expect(name.value).toBe('Alice');
  });

  it('disables on groups', async () => {
    inboxApi.get.mockImplementation((url) => {
      if (url === '/tags' || url === '/crm/statuses') return Promise.resolve({ data: { items: [] } });
      if (url === '/quick-replies') return Promise.resolve({ data: { items: [] } });
      if (url === '/inbox/conversations' || url === '/conversations') {
        return Promise.resolve({ data: { items: [ { id: 2, is_group: true, contact: { id: 'g1', name: 'Group', phone_e164: '+5511999990000', email: '' } } ] } });
      }
      if (url.includes('/messages')) return Promise.resolve({ data: { items: [] } });
      return Promise.resolve({ data: {} });
    });
    sessionStorage.clear();
    await setup();
    const name = screen.getByTestId('contact-name');
    expect(name).toBeDisabled();
    expect(name).toHaveAttribute('title', 'Indisponível em conversas de grupo');
  });
});
