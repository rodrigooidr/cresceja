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

describe('receipts', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2023-01-01T12:00:00Z'));
    inboxApi.get.mockImplementation((url) => {
      if (url === '/tags' || url === '/crm/statuses' || url === '/templates') {
        return Promise.resolve({ data: { items: [] } });
      }
      if (url === '/inbox/conversations' || url === '/conversations') {
        return Promise.resolve({ data: { items: [{ id: 1, contact: { name: 'Alice' }, channel: 'whatsapp' }] } });
      }
      if (url.includes('/messages')) {
        return Promise.resolve({ data: { items: [ { id: 'm1', type: 'text', text: 'oi', is_outbound: true, sent_at: '2023-01-01T11:59:00Z' } ] } });
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

  it('renders and updates message receipts', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <InboxPage />
        </MemoryRouter>
      );
    });
    const btn = await screen.findByText('Alice');
    await act(async () => { fireEvent.click(btn); });
    const receipt = await screen.findByTestId('msg-receipt');
    expect(receipt.textContent).toBe('✓');
    expect(receipt.getAttribute('title')).toContain('há');

    act(() => {
      socketHandlers['message:status']({ id: 'm1', delivered_at: '2023-01-01T11:59:30Z' });
    });
    await waitFor(() => expect(screen.getByTestId('msg-receipt').textContent).toBe('✓✓'));

    act(() => {
      socketHandlers['message:status']({ id: 'm1', read_at: '2023-01-01T11:59:40Z' });
    });
    await waitFor(() => expect(screen.getByTestId('msg-receipt')).toHaveClass('text-blue-600'));
  });
});
