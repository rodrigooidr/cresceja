import '@testing-library/jest-dom';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

let observers = [];

beforeEach(() => {
  observers = [];
  global.IntersectionObserver = class {
    constructor(cb) {
      this.cb = cb;
      observers.push(this);
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

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

function mockApis(count = 500, withMore = false) {
  inboxApi.get.mockImplementation((url, { params } = {}) => {
    if (url.includes('/messages')) {
      return Promise.resolve({ data: { items: [] } });
    }
    if (url === '/inbox/conversations' || url === '/conversations') {
      if (withMore && params && (params.cursor === 'n1' || params.page === 2)) {
        return Promise.resolve({ data: { items: [{ id: count + 1, contact: { name: `C${count + 1}` } }] } });
      }
      const items = Array.from({ length: count }, (_, i) => ({ id: i + 1, contact: { name: `C${i + 1}` } }));
      const data = { items };
      if (withMore) data.next_cursor = 'n1';
      return Promise.resolve({ data });
    }
    return Promise.resolve({ data: { items: [] } });
  });
}

test('janela limitada', async () => {
  mockApis();
  await act(async () => {
    render(
      <MemoryRouter>
        <InboxPage />
      </MemoryRouter>
    );
  });
  const list = await screen.findByTestId('conv-list');
  Object.defineProperty(list, 'clientHeight', { value: 600, configurable: true });
  Object.defineProperty(list, 'scrollHeight', { value: 64 * 500, configurable: true });
  act(() => fireEvent.scroll(list));
  await waitFor(() => {
    expect(list.querySelectorAll('[data-testid="conv-item"]').length).toBeLessThanOrEqual(50);
  });
});

test('scroll atualiza janela', async () => {
  inboxApi.get.mockReset();
  mockApis();
  await act(async () => {
    render(
      <MemoryRouter>
        <InboxPage />
      </MemoryRouter>
    );
  });
  const list = await screen.findByTestId('conv-list');
  Object.defineProperty(list, 'clientHeight', { value: 600, configurable: true });
  Object.defineProperty(list, 'scrollHeight', { value: 64 * 500, configurable: true });
  act(() => fireEvent.scroll(list));
  await screen.findByText('C1');
  act(() => {
    list.scrollTop = 64 * 250;
    fireEvent.scroll(list);
  });
  expect(screen.queryByText('C1')).not.toBeInTheDocument();
  expect(screen.getAllByTestId('conv-item').length).toBeLessThanOrEqual(50);
});

test('socket adiciona conversa sem pular', async () => {
  inboxApi.get.mockReset();
  mockApis();
  await act(async () => {
    render(
      <MemoryRouter>
        <InboxPage />
      </MemoryRouter>
    );
  });
  const list = await screen.findByTestId('conv-list');
  Object.defineProperty(list, 'clientHeight', { value: 600, configurable: true });
  Object.defineProperty(list, 'scrollHeight', { value: 64 * 500, configurable: true });
  act(() => {
    list.scrollTop = 64 * 250;
    fireEvent.scroll(list);
  });
  await waitFor(() => {
    expect(list.querySelectorAll('[data-testid="conv-item"]').length).toBeLessThanOrEqual(50);
  });
  const prevTop = list.scrollTop;
  await act(async () => {
    socketHandlers['conversation:new']({ conversation: { id: 999, contact: { name: 'Zed' } } });
    Object.defineProperty(list, 'scrollHeight', { value: 64 * 501, configurable: true });
  });
  expect(list.scrollTop).toBe(prevTop + 64);
  expect(screen.queryByText('Zed')).not.toBeInTheDocument();
});

test('filtros resetam scroll', async () => {
  inboxApi.get.mockReset();
  mockApis();
  await act(async () => {
    render(
      <MemoryRouter>
        <InboxPage />
      </MemoryRouter>
    );
  });
  const list = await screen.findByTestId('conv-list');
  Object.defineProperty(list, 'clientHeight', { value: 600, configurable: true });
  Object.defineProperty(list, 'scrollHeight', { value: 64 * 500, configurable: true });
  act(() => {
    list.scrollTop = 64 * 100;
    fireEvent.scroll(list);
  });
  await waitFor(() => {
    expect(list.querySelectorAll('[data-testid="conv-item"]').length).toBeLessThanOrEqual(50);
  });
  expect(list.scrollTop).toBe(64 * 100);
  const input = screen.getByTestId('filter-search-input');
  await act(async () => {
    fireEvent.change(input, { target: { value: 'C1' } });
  });
  expect(list.scrollTop).toBe(0);
  expect(await screen.findByText('C1')).toBeInTheDocument();
});

test('sentinelas', async () => {
  inboxApi.get.mockReset();
  mockApis(2, true);
  await act(async () => {
    render(
      <MemoryRouter>
        <InboxPage />
      </MemoryRouter>
    );
  });
  const list = await screen.findByTestId('conv-list');
  Object.defineProperty(list, 'clientHeight', { value: 600, configurable: true });
  Object.defineProperty(list, 'scrollHeight', { value: 64 * 2, configurable: true });
  act(() => fireEvent.scroll(list));
  expect(await screen.findByTestId('conv-top-sentinel')).toBeInTheDocument();
  expect(await screen.findByTestId('conv-bottom-sentinel')).toBeInTheDocument();
  inboxApi.get.mockClear();
  const observer = observers[0];
  await act(async () => {
    observer.cb([{ isIntersecting: true }]);
  });
  expect(inboxApi.get).toHaveBeenCalledTimes(1);
});
