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
  HTMLElement.prototype.scrollIntoView = jest.fn();
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

describe('search in chat', () => {
  beforeEach(() => {
    inboxApi.get.mockImplementation((url) => {
      if (url === '/tags' || url === '/crm/statuses' || url === '/templates') {
        return Promise.resolve({ data: { items: [] } });
      }
      if (url === '/inbox/conversations' || url === '/conversations') {
        return Promise.resolve({ data: { items: [{ id: 1, contact: { name: 'Alice' }, channel: 'whatsapp' }] } });
      }
      if (url.includes('/messages')) {
        return Promise.resolve({ data: { items: [
          { id: 'm1', type: 'text', text: 'hello world', is_outbound: true },
          { id: 'm2', type: 'text', text: 'world peace', is_outbound: false },
          { id: 'm3', type: 'text', text: 'nothing here', is_outbound: true },
        ] } });
      }
      return Promise.resolve({ data: {} });
    });
  });
  afterEach(() => {
    jest.clearAllMocks();
    Object.keys(socketHandlers).forEach((k) => delete socketHandlers[k]);
  });

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

  it('searches, navigates and clears', async () => {
    await setup();
    fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
    const input = await screen.findByTestId('chat-search-input');
    fireEvent.change(input, { target: { value: 'world' } });
    expect(document.querySelectorAll('mark').length).toBe(2);
    expect(screen.getByTestId('chat-search-count').textContent).toBe('1/2');

    fireEvent.click(screen.getByTestId('chat-search-next'));
    expect(screen.getByTestId('chat-search-count').textContent).toBe('2/2');
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('chat-search-prev'));
    expect(screen.getByTestId('chat-search-count').textContent).toBe('1/2');

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.getByTestId('chat-search-count').textContent).toBe('0/0');
    expect(document.querySelectorAll('mark').length).toBe(0);
  });
});
