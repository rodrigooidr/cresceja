import '@testing-library/jest-dom';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

beforeAll(() => {
  global.IntersectionObserver = class {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
  };
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

describe('typing indicator', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    inboxApi.get.mockImplementation((url) => {
      if (url === '/tags' || url === '/crm/statuses' || url === '/templates') {
        return Promise.resolve({ data: { items: [] } });
      }
      if (url === '/inbox/conversations' || url === '/conversations') {
        return Promise.resolve({ data: { items: [{ id: 1, contact: { name: 'Alice' }, channel: 'whatsapp' }] } });
      }
      if (url.includes('/messages')) {
        return Promise.resolve({ data: { items: [] } });
      }
      return Promise.resolve({ data: {} });
    });
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
    Object.keys(socketHandlers).forEach((k) => delete socketHandlers[k]);
  });

  async function openConversation() {
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

  it('shows and hides with events and timeout', async () => {
    await openConversation();
    act(() => {
      socketHandlers['typing:start']({ conversation_id: 1, actor: 'customer' });
    });
    expect(await screen.findByTestId('typing-indicator')).toBeInTheDocument();

    act(() => {
      socketHandlers['typing:stop']({ conversation_id: 1, actor: 'customer' });
    });
    await waitFor(() => expect(screen.queryByTestId('typing-indicator')).not.toBeInTheDocument());

    act(() => {
      socketHandlers['typing:start']({ conversation_id: 1, actor: 'customer' });
    });
    expect(await screen.findByTestId('typing-indicator')).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    await waitFor(() => expect(screen.queryByTestId('typing-indicator')).not.toBeInTheDocument());
  });
});
