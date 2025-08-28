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

function mockApis() {
  inboxApi.get.mockImplementation((url) => {
    if (url === '/tags' || url === '/crm/statuses') return Promise.resolve({ data: { items: [] } });
    if (url === '/quick-replies') return Promise.resolve({ data: { items: [] } });
    if (url === '/inbox/conversations' || url === '/conversations') {
      return Promise.resolve({ data: { items: [ { id: 1, contact: { name: 'Alice Doe', phone_e164: '+5511999999999', email: 'a@example.com' } } ] } });
    }
    if (url.includes('/messages')) return Promise.resolve({ data: { items: [] } });
    return Promise.resolve({ data: {} });
  });
  inboxApi.post.mockResolvedValue({ data: {} });
  inboxApi.put.mockResolvedValue({ data: {} });
  inboxApi.delete.mockResolvedValue({ data: {} });
}

describe('snippets palette', () => {
  beforeEach(() => {
    localStorage.setItem('inbox.snippets.v1', JSON.stringify({ v:1, items:[
      { id:'s1', title:'Boa', content:'Olá {first_name}', shortcut:'b', updated_at:'1' },
      { id:'s2', title:'Teste', content:'Teste', shortcut:'t', updated_at:'1' },
    ] }));
    mockApis();
  });
  afterEach(() => { jest.clearAllMocks(); localStorage.clear(); });

  async function setup() {
    await act(async () => {
      render(
        <MemoryRouter>
          <InboxPage />
        </MemoryRouter>
      );
    });
    const btn = await screen.findByText('Alice Doe');
    await act(async () => { fireEvent.click(btn); });
    await screen.findByTestId('composer-text');
  }

  it('opens palette, searches, inserts, edits and deletes', async () => {
    await setup();
    const ta = screen.getByTestId('composer-text');
    fireEvent.keyDown(ta, { key: 'i', ctrlKey: true });
    expect(await screen.findByTestId('snippets-palette')).toBeInTheDocument();
    const search = screen.getByTestId('snippets-search');
    fireEvent.change(search, { target: { value: 'b' } });
    expect(screen.getByTestId('snippet-item-s1')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId('snippet-item-s1'));
    expect(ta.value).toContain('Olá Alice');

    fireEvent.keyDown(ta, { key: 'i', ctrlKey: true });
    await screen.findByTestId('snippets-palette');
    const search2 = screen.getByTestId('snippets-search');
    fireEvent.change(search2, { target: { value: '' } });
    fireEvent.mouseDown(screen.getByTestId('snippet-edit-s2'));
    const title = screen.getByPlaceholderText('Título');
    fireEvent.change(title, { target: { value: 'Teste2' } });
    fireEvent.click(screen.getByTestId('snippet-save'));
    await waitFor(() => expect(screen.getByTestId('snippet-item-s2').textContent).toContain('Teste2'));
    fireEvent.mouseDown(screen.getByTestId('snippet-delete-s2'));
    await waitFor(() => expect(screen.queryByTestId('snippet-item-s2')).toBeNull());
  });
});
