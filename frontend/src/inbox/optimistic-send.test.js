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

function mockApis() {
  inboxApi.get.mockImplementation((url) => {
    if (url === '/tags' || url === '/crm/statuses' || url === '/templates') {
      return Promise.resolve({ data: { items: [] } });
    }
    if (url === '/inbox/conversations' || url === '/conversations') {
      return Promise.resolve({
        data: { items: [{ id: 1, contact: { name: 'Alice' }, channel: 'whatsapp' }] },
      });
    }
    if (url.includes('/messages')) {
      return Promise.resolve({ data: { items: [] } });
    }
    return Promise.resolve({ data: {} });
  });
}

describe('optimistic send', () => {
  beforeEach(() => {
    mockApis();
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

  it('creates sending message with tempId', async () => {
    inboxApi.post.mockImplementation(() => new Promise(() => {}));
    await setup();
    const input = screen.getByTestId('composer-text');
    fireEvent.change(input, { target: { value: 'hello' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    const sendingEl = screen.getByTestId('msg-sending');
    expect(sendingEl).toBeTruthy();
    expect(sendingEl.textContent).toContain('hello');
  });

  it('replaces optimistic message when socket arrives first', async () => {
    let resolvePost;
    inboxApi.post.mockImplementation(() => new Promise((res) => { resolvePost = res; }));
    await setup();
    const input = screen.getByTestId('composer-text');
    fireEvent.change(input, { target: { value: 'hello' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    const tempId = inboxApi.post.mock.calls[0][1].temp_id;
    act(() => {
      socketHandlers['message:new']({ conversationId: 1, message: { id: 'srv1', temp_id: tempId, type: 'text', text: 'hello', is_outbound: true } });
    });
    await waitFor(() => expect(screen.queryByTestId('msg-sending')).not.toBeInTheDocument());
    resolvePost({ data: { message: { id: 'srv1', type: 'text', text: 'hello', is_outbound: true } } });
    await waitFor(() => expect(screen.getAllByText('hello').length).toBe(1));
  });

  it('marks failed messages and retries', async () => {
    inboxApi.post.mockRejectedValueOnce(new Error('fail'));
    await setup();
    const input = screen.getByTestId('composer-text');
    fireEvent.change(input, { target: { value: 'oops' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    await waitFor(() => screen.getByTestId('msg-failed'));
    inboxApi.post.mockResolvedValueOnce({ data: { message: { id: 'srv2', type: 'text', text: 'oops', is_outbound: true } } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('retry-button'));
    });
    await waitFor(() => expect(inboxApi.post).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByTestId('msg-failed')).not.toBeInTheDocument());
  });
});

