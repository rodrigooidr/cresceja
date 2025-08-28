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
    if (url === '/tags' || url === '/crm/statuses') {
      return Promise.resolve({ data: { items: [] } });
    }
    if (url === '/quick-replies') {
      return Promise.resolve({ data: { items: [
        { id: 'qr1', title: 'Hello', content: 'Hello there', scope: 'org' },
        { id: 'qr2', title: 'Bye', content: 'Bye now', scope: 'personal' },
      ] } });
    }
    if (url === '/inbox/conversations' || url === '/conversations') {
      return Promise.resolve({ data: { items: [
        { id: 1, contact: { name: 'Alice' } },
        { id: 2, contact: { name: 'Bob' } },
      ] } });
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

describe('quick replies palette', () => {
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

  it('opens palette with / and ctrl+k, navigation and closing works', async () => {
    await setup();
    const ta = screen.getByTestId('composer-text');

    // open with slash
    fireEvent.keyDown(ta, { key: '/', code: 'Slash' });
    expect(await screen.findByTestId('qr-palette')).toBeInTheDocument();

    const search = screen.getByTestId('qr-search');
    fireEvent.change(search, { target: { value: 'he' } });
    await screen.findByTestId('qr-item-qr1');

    fireEvent.keyDown(search, { key: 'ArrowDown' });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(ta.value).toContain('Hello there');

    // open with ctrl+k
    fireEvent.keyDown(ta, { key: 'k', ctrlKey: true });
    expect(await screen.findByTestId('qr-palette')).toBeInTheDocument();

    const search2 = screen.getByTestId('qr-search');
    fireEvent.keyDown(search2, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('qr-palette')).toBeNull());
    expect(ta).toHaveFocus();

    // open and close on conversation change
    fireEvent.change(ta, { target: { value: '' } });
    fireEvent.keyDown(ta, { key: '/', code: 'Slash' });
    expect(await screen.findByTestId('qr-palette')).toBeInTheDocument();
    const conv2 = screen.getAllByTestId('conv-item')[1];
    await act(async () => { fireEvent.click(conv2); });
    await waitFor(() => expect(screen.queryByTestId('qr-palette')).toBeNull());
  });
});

