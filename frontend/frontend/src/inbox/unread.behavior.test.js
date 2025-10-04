import '@testing-library/jest-dom';
import { render, screen, act, fireEvent } from '@testing-library/react';
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
  getSocket: () => ({
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

function setupMocks({ useId = false } = {}) {
  inboxApi.get.mockImplementation((url) => {
    if (url.includes('/messages')) {
      return Promise.resolve({
        data: {
          items: [
            { id: '1', text: 'old', created_at: '2020-01-01T00:00:00Z' },
            { id: '2', text: 'new', created_at: '2020-01-02T00:00:00Z' },
          ],
        },
      });
    }
    if (url === '/inbox/conversations' || url === '/conversations') {
      return Promise.resolve({
        data: {
          items: [
            {
              id: 1,
              contact: { name: 'Alice' },
              channel: 'whatsapp',
              unread_count: 1,
              ...(useId
                ? { last_read_message_id: '1' }
                : { last_read_at: '2020-01-01T00:00:00Z' }),
            },
          ],
        },
      });
    }
    return Promise.resolve({ data: { items: [] } });
  });
  inboxApi.put.mockResolvedValue({});
}

describe('unread behavior', () => {
  afterEach(() => jest.clearAllMocks());

  it('badge, separator and mark-all-read with last_read_at', async () => {
    setupMocks();
    await act(async () => {
      render(
        <MemoryRouter>
          <InboxPage />
        </MemoryRouter>
      );
    });
    const convBtn = await screen.findByText('Alice');
    expect(screen.getByTestId('unread-badge')).toBeInTheDocument();
    await act(async () => fireEvent.click(convBtn));
    expect(await screen.findByText('new')).toBeInTheDocument();
    expect(screen.getByTestId('new-messages-separator')).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByTestId('mark-all-read')));
    expect(inboxApi.put).toHaveBeenCalledWith('/conversations/1/read');
    expect(screen.queryByTestId('unread-badge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('new-messages-separator')).not.toBeInTheDocument();
  });

  it('separator with last_read_message_id', async () => {
    setupMocks({ useId: true });
    await act(async () => {
      render(
        <MemoryRouter>
          <InboxPage />
        </MemoryRouter>
      );
    });
    const convBtn = await screen.findByText('Alice');
    await act(async () => fireEvent.click(convBtn));
    expect(await screen.findByText('new')).toBeInTheDocument();
    expect(screen.getByTestId('new-messages-separator')).toBeInTheDocument();
  });
});
