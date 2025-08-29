import '@testing-library/jest-dom';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

beforeEach(() => {
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

function mockApis() {
  inboxApi.get.mockImplementation((url) => {
    if (url.includes('/messages')) {
      const items = Array.from({ length: 200 }, (_, i) => ({ id: `m${i + 1}`, text: `msg ${i + 1}` }));
      return Promise.resolve({ data: { items } });
    }
    if (url === '/inbox/conversations' || url === '/conversations') {
      return Promise.resolve({ data: { items: [{ id: 1, contact: { name: 'Alice' } }] } });
    }
    return Promise.resolve({ data: { items: [] } });
  });
}

test('virtualizes timeline and sticks to bottom', async () => {
  mockApis();
  await act(async () => {
    render(
      <MemoryRouter>
        <InboxPage />
      </MemoryRouter>
    );
  });
  const btn = await screen.findByText('Alice');
  await act(async () => fireEvent.click(btn));
  const container = await screen.findByTestId('messages-container');
  Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true });
  Object.defineProperty(container, 'scrollHeight', { value: 12800, configurable: true });
  act(() => {
    container.scrollTop = container.scrollHeight - container.clientHeight;
    fireEvent.scroll(container);
  });
  expect(container.querySelectorAll('[data-message="true"]').length).toBeLessThanOrEqual(50);

  act(() => {
    socketHandlers['message:new']({
      conversation_id: 1,
      message: { id: 'm201', text: 'newest' },
    });
    Object.defineProperty(container, 'scrollHeight', { value: 12864, configurable: true });
  });
  expect(await screen.findByText('newest')).toBeInTheDocument();
  expect(container.scrollTop).toBe(container.scrollHeight);
});
