import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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
    makeSocket: () => ({
      on: (evt, cb) => {
        handlers[evt] = cb;
      },
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
import { readConvCache, writeConvCache, mergeMessages, pruneLRU } from './cache';

describe('cache behavior', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });
  afterEach(() => {
    jest.clearAllMocks();
    Object.keys(socketHandlers).forEach((k) => delete socketHandlers[k]);
  });

  it('cache hit + refresh', async () => {
    let conv1Calls = 0;
    let resolveRefresh;
    const refreshPromise = new Promise((res) => {
      resolveRefresh = res;
    });
    inboxApi.get.mockImplementation((url) => {
      if (url === '/tags' || url === '/crm/statuses' || url === '/templates') {
        return Promise.resolve({ data: { items: [] } });
      }
      if (url === '/inbox/conversations' || url === '/conversations') {
        return Promise.resolve({
          data: {
            items: [
              { id: 1, contact: { name: 'Alice' }, channel: 'whatsapp' },
              { id: 2, contact: { name: 'Bob' }, channel: 'whatsapp' },
            ],
          },
        });
      }
      if (url.includes('/conversations/1/messages')) {
        conv1Calls++;
        if (conv1Calls === 1) {
          return Promise.resolve({
            data: { items: [{ id: 'm1', text: 'hi', created_at: '2020-01-01T00:00:00Z' }] },
            headers: { etag: 'v1' },
          });
        }
        if (conv1Calls === 2) {
          return refreshPromise.then(() => ({
            data: {
              items: [
                { id: 'm1', text: 'hi', created_at: '2020-01-01T00:00:00Z' },
                { id: 'm2', text: 'ola', created_at: '2020-01-02T00:00:00Z' },
              ],
            },
            headers: { etag: 'v2' },
          }));
        }
      }
      if (url.includes('/conversations/2/messages')) {
        return Promise.resolve({
          data: { items: [{ id: 'x', text: 'other', created_at: '2020-01-01T00:00:00Z' }] },
        });
      }
      return Promise.resolve({ data: { items: [] } });
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <InboxPage />
        </MemoryRouter>
      );
    });
    const conv1Btn = await screen.findByText('Alice');
    await act(async () => fireEvent.click(conv1Btn));
    await screen.findByText('hi');
    const conv2Btn = await screen.findByText('Bob');
    await act(async () => fireEvent.click(conv2Btn));
    await screen.findByText('other');
    await act(async () => fireEvent.click(conv1Btn));
    await screen.findByText('hi');
    expect(screen.getByTestId('cache-hit')).toBeInTheDocument();
    expect(screen.getByTestId('cache-refreshing')).toBeInTheDocument();
    expect(screen.queryByText('Carregando…')).not.toBeInTheDocument();
    await act(async () => resolveRefresh());
    await waitFor(() => screen.getByText('ola'));
    await waitFor(() => expect(screen.queryByTestId('cache-refreshing')).not.toBeInTheDocument());
  });

  it('TTL expirada', async () => {
    inboxApi.get.mockImplementation((url) => {
      if (url === '/tags' || url === '/crm/statuses' || url === '/templates') {
        return Promise.resolve({ data: { items: [] } });
      }
      if (url === '/inbox/conversations' || url === '/conversations') {
        return Promise.resolve({
          data: {
            items: [{ id: 1, contact: { name: 'Alice' }, channel: 'whatsapp' }],
          },
        });
      }
      if (url.includes('/conversations/1/messages')) {
        return Promise.resolve({
          data: { items: [{ id: 'm1', text: 'fresh', created_at: '2020-01-01T00:00:00Z' }] },
        });
      }
      return Promise.resolve({ data: { items: [] } });
    });
    writeConvCache(1, {
      items: [{ id: 'old', text: 'old', created_at: '2019-01-01T00:00:00Z' }],
      updatedAt: Date.now() - 11 * 60 * 1000,
    });
    await act(async () => {
      render(
        <MemoryRouter>
          <InboxPage />
        </MemoryRouter>
      );
    });
    const conv1Btn = await screen.findByText('Alice');
    await act(async () => fireEvent.click(conv1Btn));
    await screen.findByText('fresh');
    expect(screen.queryByText('old')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cache-hit')).not.toBeInTheDocument();
  });

  it('socket atualiza cache', async () => {
    inboxApi.get.mockImplementation((url) => {
      if (url === '/tags' || url === '/crm/statuses' || url === '/templates') {
        return Promise.resolve({ data: { items: [] } });
      }
      if (url === '/inbox/conversations' || url === '/conversations') {
        return Promise.resolve({
          data: {
            items: [
              { id: 1, contact: { name: 'Alice' }, channel: 'whatsapp' },
              { id: 2, contact: { name: 'Bob' }, channel: 'whatsapp' },
            ],
          },
        });
      }
      if (url.includes('/conversations/1/messages')) {
        return Promise.resolve({
          data: { items: [{ id: 'a', text: 'hi', created_at: '2020-01-01T00:00:00Z' }] },
        });
      }
      if (url.includes('/conversations/2/messages')) {
        return Promise.resolve({
          data: { items: [{ id: 'b', text: 'hey', created_at: '2020-01-01T00:00:00Z' }] },
        });
      }
      return Promise.resolve({ data: { items: [] } });
    });
    await act(async () => {
      render(
        <MemoryRouter>
          <InboxPage />
        </MemoryRouter>
      );
    });
    const conv1Btn = await screen.findByText('Alice');
    await act(async () => fireEvent.click(conv1Btn));
    await screen.findByText('hi');
    const conv2Btn = await screen.findByText('Bob');
    await act(async () => fireEvent.click(conv2Btn));
    await screen.findByText('hey');
    await act(async () => {
      socketHandlers['message:new']({
        conversationId: 1,
        message: { id: 'a2', text: 'socket', created_at: '2020-01-02T00:00:00Z' },
      });
    });
    let cache1 = readConvCache(1);
    expect(cache1.items.find((m) => m.id === 'a2')).toBeTruthy();
    await act(async () => {
      socketHandlers['message:updated']({
        conversationId: 2,
        message: { id: 'b', text: 'edited', created_at: '2020-01-01T00:00:00Z' },
      });
    });
    const cache2 = readConvCache(2);
    expect(cache2.items.find((m) => m.id === 'b').text).toBe('edited');
  });

  it('paginacao mescla sem duplicar', () => {
    const p1 = [
      { id: '1', created_at: '2020-01-01T00:00:00Z' },
      { id: '2', created_at: '2020-01-02T00:00:00Z' },
    ];
    const p2 = [
      { id: '0', created_at: '2019-12-31T00:00:00Z' },
      { id: '1', created_at: '2020-01-01T00:00:00Z' },
    ];
    const merged = mergeMessages(p1, p2);
    expect(merged.map((m) => m.id)).toEqual(['0', '1', '2']);
  });

  it('LRU mantem 20 mais recentes', () => {
    for (let i = 1; i <= 25; i++) {
      writeConvCache(i, { items: [], updatedAt: Date.now() });
    }
    for (let i = 1; i <= 5; i++) {
      readConvCache(i);
    }
    pruneLRU(20);
    const remaining = [];
    for (let i = 1; i <= 25; i++) {
      if (sessionStorage.getItem(`inbox:conv:${i}:v1`)) remaining.push(i);
    }
    expect(remaining.length).toBe(20);
    expect(remaining).toEqual(expect.arrayContaining([1, 2, 3]));
    expect(remaining).not.toContain(6);
  });
});
