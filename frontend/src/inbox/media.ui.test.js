import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
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

beforeAll(() => {
  global.URL.createObjectURL = jest.fn(() => 'blob:');
  global.URL.revokeObjectURL = jest.fn();
});

function mockApis() {
  inboxApi.get.mockImplementation((url) => {
    if (url.includes('/messages')) {
      return Promise.resolve({ data: { items: [] } });
    }
    if (url.includes('/inbox/conversations') || url.includes('/conversations')) {
      return Promise.resolve({ data: { items: [{ id: 1, contact: { name: 'Alice' } }] } });
    }
    return Promise.resolve({ data: {} });
  });
  inboxApi.post.mockResolvedValue({ data: { assets: [{ id: 'a1', url: 'u', thumb_url: 'u' }] } });
}

test('shows toasts for rejected and accepted uploads', async () => {
  mockApis();
  await act(async () => {
    render(
      <MemoryRouter>
        <InboxPage />
      </MemoryRouter>
    );
  });
  await screen.findByText('Alice');
  fireEvent.click(screen.getByText('Alice'));
  const dropzone = await screen.findByTestId('composer-dropzone');

  const bad = new File([new Uint8Array(1)], 'bad.txt', { type: 'text/plain' });
  await act(async () => {
    fireEvent.drop(dropzone, { dataTransfer: { files: [bad] } });
  });
  expect(await screen.findByText(/mime-not-allowed/)).toBeInTheDocument();

  const good = new File([new Uint8Array(1)], 'ok.png', { type: 'image/png' });
  await act(async () => {
    fireEvent.drop(dropzone, { dataTransfer: { files: [good] } });
  });
  expect(await screen.findByText(/ok.png pronto para enviar/)).toBeInTheDocument();
  expect(screen.getAllByTestId('pending-attachment').length).toBeGreaterThan(0);
});
