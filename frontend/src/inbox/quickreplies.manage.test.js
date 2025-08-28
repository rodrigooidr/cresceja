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
import { loadQuickReplies } from './quickreplies';

function mockApis() {
  inboxApi.get.mockImplementation((url) => {
    if (url === '/tags' || url === '/crm/statuses') {
      return Promise.resolve({ data: { items: [] } });
    }
    if (url === '/quick-replies') {
      return Promise.resolve({ data: { items: [
        { id: 'o1', title: 'Org', content: 'Org', scope: 'org' },
      ] } });
    }
    if (url === '/inbox/conversations' || url === '/conversations') {
      return Promise.resolve({ data: { items: [ { id: 1, contact: { name: 'Alice' } } ] } });
    }
    if (url.includes('/messages')) {
      return Promise.resolve({ data: { items: [] } });
    }
    return Promise.resolve({ data: {} });
  });
  inboxApi.post.mockResolvedValue({ data: { id: 'p1', title: 'Novo', content: 'novo', scope: 'personal' } });
  inboxApi.put.mockResolvedValue({ data: { id: 'p1', title: 'Editado', content: 'novo', scope: 'personal' } });
  inboxApi.delete.mockResolvedValue({ data: {} });
}

describe('quick replies manage', () => {
  beforeEach(() => { mockApis(); sessionStorage.clear(); });
  afterEach(() => { jest.clearAllMocks(); });

  async function setup() {
    await act(async () => {
      render(
        <MemoryRouter>
          <InboxPage />
        </MemoryRouter>
      );
    });
    const btn = await screen.findByText('Alice');
    await act(async () => { fireEvent.click(btn); });
    await screen.findByTestId('composer-text');
  }

  it('creates, edits, deletes and revalidates cache', async () => {
    await setup();
    const ta = screen.getByTestId('composer-text');
    fireEvent.change(ta, { target: { value: 'novo' } });
    fireEvent.click(screen.getByTestId('qr-save-open'));
    const titleInput = screen.getByPlaceholderText('Título');
    fireEvent.change(titleInput, { target: { value: 'Novo' } });
    fireEvent.click(screen.getByTestId('qr-save-submit'));
    await waitFor(() => expect(inboxApi.post).toHaveBeenCalled());

    fireEvent.change(ta, { target: { value: '' } });
    fireEvent.keyDown(ta, { key: '/', code: 'Slash' });
    expect(await screen.findByTestId('qr-item-p1')).toBeInTheDocument();
    const search = screen.getByTestId('qr-search');
    fireEvent.keyDown(search, { key: 'Escape' });

    fireEvent.change(ta, { target: { value: '' } });
    fireEvent.keyDown(ta, { key: '/', code: 'Slash' });
    await screen.findByTestId('qr-item-p1');
    fireEvent.mouseDown(screen.getByTestId('qr-edit-open-p1'));
    const editTitle = screen.getByPlaceholderText('Título');
    fireEvent.change(editTitle, { target: { value: 'Editado' } });
    fireEvent.click(screen.getByTestId('qr-save-submit'));
    await waitFor(() => expect(inboxApi.put).toHaveBeenCalled());
    fireEvent.change(ta, { target: { value: '' } });
    fireEvent.keyDown(ta, { key: '/', code: 'Slash' });
    await waitFor(() => expect(screen.getByTestId('qr-item-p1').textContent).toContain('Editado'));
    const search2 = screen.getByTestId('qr-search');
    fireEvent.keyDown(search2, { key: 'Escape' });

    fireEvent.keyDown(ta, { key: '/', code: 'Slash' });
    await screen.findByTestId('qr-item-p1');
    fireEvent.mouseDown(screen.getByTestId('qr-delete-p1'));
    await waitFor(() => expect(inboxApi.delete).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId('qr-item-p1')).toBeNull());

    // TTL revalidation
    sessionStorage.setItem('inbox:quickreplies:v1', JSON.stringify({ ts: Date.now() - 11 * 60 * 1000, items: [{ id: 'old', title: 'Old', content: 'old', scope: 'org' }] }));
    inboxApi.get.mockResolvedValueOnce({ data: { items: [{ id: 'fresh', title: 'Fresh', content: 'fresh', scope: 'org' }] } });
    const r = await loadQuickReplies();
    expect(r.items[0].id).toBe('old');
    await waitFor(() => expect(JSON.parse(sessionStorage.getItem('inbox:quickreplies:v1')).items[0].id).toBe('fresh'));
  });
});

