import '@testing-library/jest-dom';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let observers = [];
beforeEach(() => {
  observers = [];
  global.IntersectionObserver = class {
    constructor(cb) { this.cb = cb; observers.push(this); }
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const handlers = {};
jest.mock('../sockets/socket', () => {
  const handlers = {};
  return {
    makeSocket: () => ({
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

describe('socket resilience', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    inboxApi.get.mockImplementation((url, { params } = {}) => {
      if (url.includes('/messages')) {
        if (params && params.after) {
          return Promise.resolve({ data: { items: [{ id: 'm2', text: 'after' }] } });
        }
        return Promise.resolve({ data: { items: [{ id: 'm1', text: 'hi' }] } });
      }
      if (url === '/inbox/conversations' || url === '/conversations') {
        return Promise.resolve({ data: { items: [{ id: 1, contact: { name: 'Alice' } }] } });
      }
      return Promise.resolve({ data: { items: [] } });
    });
    inboxApi.put.mockResolvedValue({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('reconecta com toast e resync', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <InboxPage />
        </MemoryRouter>
      );
    });
    const convBtn = await screen.findByText('Alice');
    await act(async () => fireEvent.click(convBtn));
    expect(await screen.findByText('hi')).toBeInTheDocument();

    // disconnect
    act(() => { socketHandlers.disconnect(); });
    expect(screen.getByTestId('toast-error')).toBeInTheDocument();
    act(() => { jest.advanceTimersByTime(5000); });
    expect(screen.queryByTestId('toast-error')).not.toBeInTheDocument();

    // reconnect
    await act(async () => { socketHandlers.connect(); });
    expect(await screen.findByTestId('socket-reconnected')).toBeInTheDocument();
    expect(await screen.findByText('after')).toBeInTheDocument();
    const msgCalls = inboxApi.get.mock.calls.filter((c) => c[0].includes('/messages') && c[1]?.params?.after);
    expect(msgCalls.length).toBe(1);
    act(() => { jest.advanceTimersByTime(2000); });
    expect(screen.queryByTestId('socket-reconnected')).not.toBeInTheDocument();
  });
});
