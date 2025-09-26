import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

beforeAll(() => {
  global.IntersectionObserver = class { constructor(){} observe(){} unobserve(){} disconnect(){} };
});

jest.mock('../sockets/socket', () => {
  const handlers = {};
  return {
    getSocket: () => ({
      on: (evt, cb) => { handlers[evt] = cb; },
      close: jest.fn(),
      disconnect: jest.fn(),
    }),
    __handlers: handlers,
  };
});

jest.mock('../api/inboxApi', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
  apiUrl: (x) => x,
}));

import InboxPage from '../pages/inbox/InboxPage.jsx';
import inboxApi from '../api/inboxApi';
import { __handlers as socketHandlers } from '../sockets/socket';

const setupGet = () => {
  inboxApi.get.mockImplementation((url) => {
    if (url === '/tags' || url === '/crm/statuses' || url === '/templates') {
      return Promise.resolve({ data: { items: [] } });
    }
    if (url === '/inbox/conversations' || url === '/conversations') {
      return Promise.resolve({ data: { items: [
        { id: 1, contact: { name: 'Alice' }, channel: 'whatsapp' },
        { id: 2, contact: { name: 'Bob' }, channel: 'whatsapp' },
      ] } });
    }
    return Promise.resolve({ data: {} });
  });
};

const renderPage = async () => {
  setupGet();
  render(<MemoryRouter><InboxPage /></MemoryRouter>);
  await screen.findByTestId('conv-check-1');
};

describe('quick actions bulk', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('user', JSON.stringify({ id: 99, role: 'OrgAdmin' }));
  });

  test('uses bulk endpoint when available', async () => {
    inboxApi.post.mockResolvedValue({});
    await renderPage();
    fireEvent.click(screen.getByTestId('conv-check-1'));
    fireEvent.click(screen.getByTestId('conv-check-2'));
    fireEvent.click(screen.getByTestId('qa-archive-btn'));
    await waitFor(() => expect(inboxApi.post).toHaveBeenCalled());
    const body = inboxApi.post.mock.calls[0][1];
    expect(body.ids).toEqual([1,2]);
    expect(body.action).toBe('archive');
  });

  test('falls back when bulk missing', async () => {
    inboxApi.post.mockImplementation((url) => {
      if (url === '/conversations/bulk') return Promise.reject({ response: { status: 404 } });
      return Promise.resolve({});
    });
    inboxApi.put.mockResolvedValue({});
    await renderPage();
    fireEvent.click(screen.getByTestId('conv-check-1'));
    fireEvent.click(screen.getByTestId('conv-check-2'));
    fireEvent.click(screen.getByTestId('qa-archive-btn'));
    await waitFor(() => expect(inboxApi.put).toHaveBeenCalledTimes(2));
    const urls = inboxApi.put.mock.calls.map((c) => c[0]).sort();
    expect(urls).toEqual(['/conversations/1/archive','/conversations/2/archive']);
  });

  test('undo reverts action', async () => {
    inboxApi.post.mockResolvedValue({});
    await renderPage();
    fireEvent.click(screen.getByTestId('conv-check-1'));
    fireEvent.click(screen.getByTestId('qa-read-btn'));
    await waitFor(() => expect(inboxApi.post).toHaveBeenCalled());
    inboxApi.post.mockClear();
    fireEvent.click(screen.getByTestId('undo-btn'));
    await waitFor(() => expect(inboxApi.post).toHaveBeenCalled());
    const body = inboxApi.post.mock.calls[0][1];
    expect(body.payload.read).toBe(false);
  });

  test('removes item when socket confirms', async () => {
    inboxApi.post.mockResolvedValue({});
    await renderPage();
    fireEvent.click(screen.getByTestId('conv-check-1'));
    fireEvent.click(screen.getByTestId('qa-archive-btn'));
    await waitFor(() => expect(screen.queryByTestId('conv-check-1')).not.toBeInTheDocument());
    // simulate socket
    socketHandlers['conversation:updated']({ conversation: { id: 1, archived: true } });
    await waitFor(() => expect(screen.queryByTestId('conv-check-1')).not.toBeInTheDocument());
  });
});
