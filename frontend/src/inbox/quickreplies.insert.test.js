import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('../sockets/socket', () => ({
  getSocket: () => ({ on: jest.fn(), close: jest.fn(), disconnect: jest.fn() }),
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
    if (url === '/tags' || url === '/crm/statuses') {
      return Promise.resolve({ data: { items: [] } });
    }
    if (url === '/quick-replies') {
      return Promise.resolve({ data: { items: [
        { id: 'qr1', title: 'Hello', content: 'Hello', scope: 'org' },
        { id: 'qr2', title: 'Saudação', content: 'Oi {{nome}} {{produto}}', scope: 'org' },
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
  inboxApi.post.mockResolvedValue({ data: {} });
  inboxApi.put.mockResolvedValue({ data: {} });
  inboxApi.delete.mockResolvedValue({ data: {} });
}

describe('quick replies insert', () => {
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

  it('replaces slash and keeps caret', async () => {
    await setup();
    const ta = screen.getByTestId('composer-text');
    fireEvent.change(ta, { target: { value: 'Before after' } });
    ta.setSelectionRange(7, 7);
    fireEvent.keyDown(ta, { key: '/', code: 'Slash' });
    fireEvent.change(ta, { target: { value: 'Before /after' } });
    ta.setSelectionRange(8, 8);
    const search = await screen.findByTestId('qr-search');
    fireEvent.change(search, { target: { value: 'hello' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    await waitFor(() => expect(ta.value).toBe('Before Helloafter'));
    await waitFor(() => expect(ta.selectionStart).toBe('Before Hello'.length));
  });

  it('handles variables with defaults and validation', async () => {
    await setup();
    const ta = screen.getByTestId('composer-text');
    fireEvent.keyDown(ta, { key: '/', code: 'Slash' });
    const search = await screen.findByTestId('qr-search');
    fireEvent.change(search, { target: { value: 'Saudação' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    const nome = await screen.findByTestId('qr-var-nome');
    const prod = screen.getByTestId('qr-var-produto');
    expect(nome.value).toBe('Alice');
    const insertBtn = screen.getByTestId('qr-insert');
    expect(insertBtn).toBeDisabled();
    fireEvent.change(prod, { target: { value: 'Loja' } });
    expect(insertBtn).toBeEnabled();
    fireEvent.click(insertBtn);
    await waitFor(() => expect(ta.value).toBe('Oi Alice Loja'));
    expect(ta.selectionStart).toBe(ta.value.length);
  });
});

