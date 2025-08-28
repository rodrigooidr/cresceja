import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import InboxPage from '../pages/inbox/InboxPage.jsx';
import inboxApi from '../api/inboxApi';

jest.mock('../sockets/socket', () => ({
  makeSocket: () => ({ on: jest.fn(), close: jest.fn(), disconnect: jest.fn() }),
}));

jest.mock('../api/inboxApi', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
  apiUrl: (x) => x,
}));

beforeEach(() => { jest.clearAllMocks(); });

function mockApis() {
  inboxApi.get.mockImplementation((url) => {
    if (url.includes('/messages')) return Promise.resolve({ data: { items: [] } });
    if (url.includes('/inbox/conversations') || url.includes('/conversations')) {
      return Promise.resolve({ data: { items: [{ id: 1, contact: { name: 'Alice' } }] } });
    }
    return Promise.resolve({ data: {} });
  });
}

test('shows progress and cancel upload', async () => {
  mockApis();
  const handlers = [];
  inboxApi.post.mockImplementation((url, form, config) => {
    return new Promise((resolve, reject) => {
      handlers.push({ resolve, reject, config });
      if (config?.signal) {
        config.signal.addEventListener('abort', () => reject(new Error('canceled')));
      }
    });
  });

  await act(async () => {
    render(
      <MemoryRouter>
        <InboxPage />
      </MemoryRouter>
    );
  });
  await screen.findByText('Alice');
  fireEvent.click(screen.getByText('Alice'));
  const input = await screen.findByTestId('composer-file-input');

  const f1 = new File([new Uint8Array(1)], 'a1.png', { type: 'image/png' });
  const f2 = new File([new Uint8Array(1)], 'a2.png', { type: 'image/png' });
  await act(async () => {
    fireEvent.change(input, { target: { files: [f1, f2] } });
  });

  expect(screen.getAllByTestId('attachments-pending-item').length).toBe(2);

  act(() => {
    handlers[1].config.onUploadProgress({ loaded: 50, total: 100 });
  });
  expect(screen.getAllByText('50%').length).toBeGreaterThan(0);

  const cancelBtn = screen.getAllByTestId('attachments-cancel')[0];
  await act(async () => { fireEvent.click(cancelBtn); });
  expect(await screen.findByText(/Upload cancelado/)).toBeInTheDocument();
  expect(screen.getAllByTestId('attachments-pending-item').length).toBe(1);

  act(() => {
    handlers[1].resolve({ data: { assets: [{ id: 'a2', url: 'u', thumb_url: 'u' }] } });
  });
  await waitFor(() => expect(screen.queryByTestId('attachments-pending-item')).toBeNull());
  expect(screen.getAllByTestId('pending-attachment').length).toBe(1);
});
