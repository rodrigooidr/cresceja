import '@testing-library/jest-dom';
import { render, screen, act, fireEvent } from '@testing-library/react';
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

jest.mock('../sockets/socket', () => ({
  makeSocket: () => ({
    on: jest.fn(),
    close: jest.fn(),
    disconnect: jest.fn(),
  }),
}));

jest.mock('../api/inboxApi', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
  apiUrl: (x) => x,
}));

import InboxPage from '../pages/inbox/InboxPage.jsx';
import inboxApi from '../api/inboxApi';

function mockApis() {
  inboxApi.get.mockImplementation((url, { params } = {}) => {
    if (url.includes('/messages')) {
      if (params && params.before) {
        return Promise.resolve({ data: { items: [{ id: 'm0', text: 'old' }] } });
      }
      return Promise.resolve({ data: { items: [{ id: 'm1', text: 'hi' }, { id: 'm2', text: 'there' }], next_cursor: 'm1' } });
    }
    if (url === '/inbox/conversations' || url === '/conversations') {
      if (params && (params.cursor === 'n1' || params.page === 2)) {
        return Promise.resolve({ data: { items: [{ id: 2, contact: { name: 'Bob' } }, { id: 3, contact: { name: 'Carl' } }] } });
      }
      return Promise.resolve({ data: { items: [{ id: 1, contact: { name: 'Alice' } }, { id: 2, contact: { name: 'Bob' } }], next_cursor: 'n1' } });
    }
    return Promise.resolve({ data: { items: [] } });
  });
}

test('paginacao de conversas e timeline com scroll infinito e dedup', async () => {
  mockApis();
  await act(async () => {
    render(
      <MemoryRouter>
        <InboxPage />
      </MemoryRouter>
    );
  });
  expect(await screen.findByText('Alice')).toBeInTheDocument();
  expect(observers.length).toBeGreaterThan(0);

  // Trigger list pagination
  const listObserver = observers[0];
  await act(async () => {
    listObserver.cb([{ isIntersecting: true }]);
  });
  expect(await screen.findByText('Carl')).toBeInTheDocument();
  expect(screen.getAllByText('Bob').length).toBe(1);

  // Open conversation
  await act(async () => {
    fireEvent.click(screen.getByText('Alice'));
  });
  expect(await screen.findByText('hi')).toBeInTheDocument();
  expect(observers.length).toBeGreaterThan(1);

  const timelineObserver = observers[observers.length - 1];
  await act(async () => {
    timelineObserver.cb([{ isIntersecting: true }]);
  });
  expect(await screen.findByText('old')).toBeInTheDocument();
});
