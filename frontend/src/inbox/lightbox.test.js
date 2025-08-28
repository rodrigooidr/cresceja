import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('../sockets/socket', () => ({
  makeSocket: () => ({ on: jest.fn(), close: jest.fn(), disconnect: jest.fn() }),
}));

jest.mock('../api/inboxApi', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
  apiUrl: (x) => x,
}));

import InboxPage from '../pages/inbox/InboxPage.jsx';
import inboxApi from '../api/inboxApi';

function mockApis() {
  inboxApi.get.mockImplementation((url) => {
    if (url === '/tags' || url === '/crm/statuses' || url === '/templates') {
      return Promise.resolve({ data: { items: [] } });
    }
    if (url === '/inbox/conversations' || url === '/conversations') {
      return Promise.resolve({ data: { items: [{ id: 1, contact: { name: 'Alice' }, channel: 'whatsapp' }] } });
    }
    if (url === '/conversations/1/messages' || url === '/inbox/conversations/1/messages') {
      return Promise.resolve({
        data: {
          items: [
            {
              id: 'm1',
              from: 'agent',
              attachments: [
                { id: 'a1', url: '/img1.jpg', thumb_url: '/img1.jpg' },
                { id: 'a2', url: '/file.pdf', thumb_url: '/file-thumb.jpg' },
              ],
            },
          ],
        },
      });
    }
    return Promise.resolve({ data: {} });
  });
  inboxApi.post.mockResolvedValue({ data: {} });
}

describe('Lightbox behavior', () => {
  beforeEach(() => {
    mockApis();
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('opens from thumb and closes with Esc returning focus', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <InboxPage />
        </MemoryRouter>
      );
    });
    const btn = await screen.findByText('Alice');
    await act(async () => { fireEvent.click(btn); });
    const thumbs = await screen.findAllByTestId('attachment-thumb');
    const first = thumbs[0];
    first.focus();
    fireEvent.click(first);
    expect(screen.getByTestId('lightbox-open')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('lightbox-open')).not.toBeInTheDocument());
    expect(first).toHaveFocus();

    const fileLink = thumbs[1];
    expect(fileLink).toHaveAttribute('target', '_blank');
    expect(fileLink).toHaveAttribute('download');
    fireEvent.click(fileLink);
    expect(screen.queryByTestId('lightbox-open')).not.toBeInTheDocument();
  });
});
