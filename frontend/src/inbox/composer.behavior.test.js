import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

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

function mockApis() {
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
    if (url.includes('/messages')) {
      return Promise.resolve({ data: { items: [] } });
    }
    return Promise.resolve({ data: {} });
  });
  inboxApi.post.mockImplementation((url) => {
    if (url.includes('/attachments')) {
      return Promise.resolve({ data: { assets: [{ id: 'a1', url: '/u', thumb_url: '/t' }] } });
    }
    return Promise.resolve({
      data: { message: { id: 'srv1', type: 'text', text: 'hello', is_outbound: true } },
    });
  });
}

describe('composer behavior', () => {
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

  it('emoji opens/closes via toggle, outside, Esc, send and conversation change', async () => {
    await setup();
    const emojiBtn = screen.getByTestId('emoji-toggle');
    fireEvent.click(emojiBtn);
    expect(screen.getByTestId('emoji-popover')).toBeInTheDocument();

    fireEvent.click(document.body);
    await waitFor(() => expect(screen.queryByTestId('emoji-popover')).not.toBeInTheDocument());
    expect(document.activeElement).toBe(emojiBtn);

    fireEvent.click(emojiBtn);
    expect(screen.getByTestId('emoji-popover')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('emoji-popover')).not.toBeInTheDocument());
    expect(document.activeElement).toBe(emojiBtn);

    fireEvent.click(emojiBtn);
    expect(screen.getByTestId('emoji-popover')).toBeInTheDocument();
    // send closes
    const input = screen.getByTestId('composer-text');
    fireEvent.change(input, { target: { value: 'hi' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    await waitFor(() => expect(screen.queryByTestId('emoji-popover')).not.toBeInTheDocument());
    expect(document.activeElement).toBe(emojiBtn);

    // reopen and switch conversation
    fireEvent.click(emojiBtn);
    expect(screen.getByTestId('emoji-popover')).toBeInTheDocument();
    const convBtn = await screen.findByText('Bob');
    await act(async () => { fireEvent.click(convBtn); });
    await waitFor(() => expect(screen.queryByTestId('emoji-popover')).not.toBeInTheDocument());
    const newBtn = screen.getByTestId('emoji-toggle');
    expect(document.activeElement).toBe(newBtn);
  });

  it('Enter sends and Shift+Enter inserts newline', async () => {
    await setup();
    const input = screen.getByTestId('composer-text');
    fireEvent.change(input, { target: { value: 'hello' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    await waitFor(() => expect(inboxApi.post).toHaveBeenCalled());

    fireEvent.change(input, { target: { value: 'line' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    fireEvent.change(input, { target: { value: 'line\n' } });
    expect(inboxApi.post).toHaveBeenCalledTimes(1);
  });

  it('adds attachments via drag-and-drop and paste', async () => {
    await setup();
    const area = screen.getByTestId('composer-dropzone');
    const file = new File(['hi'], 'hi.png', { type: 'image/png' });
    fireEvent.drop(area, { dataTransfer: { files: [file] } });
    await waitFor(() => screen.getByTestId('pending-attachments'));

    const input = screen.getByTestId('composer-text');
    fireEvent.paste(input, { clipboardData: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByTestId('pending-attachments').children.length).toBeGreaterThan(1);
    });
  });
});
