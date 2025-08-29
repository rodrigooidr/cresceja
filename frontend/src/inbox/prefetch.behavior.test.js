import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

beforeAll(() => {
  global.IntersectionObserver = class {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

jest.mock('../sockets/socket', () => ({
  getSocket: () => ({ on: jest.fn(), close: jest.fn(), disconnect: jest.fn() }),
}));

jest.mock('../api/inboxApi', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
  apiUrl: (x) => x,
}));

import InboxPage from '../pages/inbox/InboxPage.jsx';
import inboxApi from '../api/inboxApi';
import { writeConvCache } from './cache';

describe('prefetch behavior', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  function setupMocks() {
    inboxApi.get.mockImplementation((url) => {
      if (url === '/tags' || url === '/crm/statuses' || url === '/templates') {
        return Promise.resolve({ data: { items: [] } });
      }
      if (url === '/inbox/conversations' || url === '/conversations') {
        return Promise.resolve({
          data: {
            items: [
              { id: 1, contact: { name: 'A' }, channel: 'whatsapp' },
              { id: 2, contact: { name: 'B' }, channel: 'whatsapp' },
              { id: 3, contact: { name: 'C' }, channel: 'whatsapp' },
            ],
          },
        });
      }
      if (url.includes('/conversations/1/messages')) {
        return Promise.resolve({ data: { items: [{ id: 'm1', text: '1' }] } });
      }
      if (url.includes('/conversations/2/messages')) {
        return Promise.resolve({ data: { items: [{ id: 'm2', text: '2' }] } });
      }
      if (url.includes('/conversations/3/messages')) {
        return Promise.resolve({ data: { items: [{ id: 'm3', text: '3' }] } });
      }
      return Promise.resolve({ data: { items: [] } });
    });
  }

  it('vizinhos', async () => {
    jest.useFakeTimers();
    setupMocks();
    await act(async () => {
      render(
        <MemoryRouter>
          <InboxPage />
        </MemoryRouter>
      );
    });
    const btn = await screen.findByText('B');
    await act(async () => fireEvent.click(btn));
    await screen.findByText('2');
    act(() => {
      jest.advanceTimersByTime(300);
    });
    await act(async () => {});
    const log = screen.getByTestId('prefetch-log');
    expect(log.textContent).toContain('1');
    expect(log.textContent).toContain('3');
    jest.useRealTimers();
  });

  it('hover', async () => {
    jest.useFakeTimers();
    setupMocks();
    await act(async () => {
      render(
        <MemoryRouter>
          <InboxPage />
        </MemoryRouter>
      );
    });
    const btn = await screen.findByText('A');
    await act(async () => fireEvent.click(btn));
    await screen.findByText('1');
    const hoverBtn = await screen.findByText('C');
    fireEvent.mouseEnter(hoverBtn);
    act(() => {
      jest.advanceTimersByTime(250);
    });
    await act(async () => {});
    const log = screen.getByTestId('prefetch-log');
    expect(log.textContent).toContain('3');
    jest.useRealTimers();
  });

  it('cache valido evita prefetch', async () => {
    jest.useFakeTimers();
    writeConvCache(1, { items: [], updatedAt: Date.now() });
    setupMocks();
    await act(async () => {
      render(
        <MemoryRouter>
          <InboxPage />
        </MemoryRouter>
      );
    });
    const btn = await screen.findByText('B');
    await act(async () => fireEvent.click(btn));
    await screen.findByText('2');
    act(() => {
      jest.advanceTimersByTime(300);
    });
    await act(async () => {});
    const log = screen.getByTestId('prefetch-log');
    expect(log.textContent).toContain('3');
    expect(log.textContent).not.toContain('1');
    jest.useRealTimers();
  });
});
