import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

beforeAll(() => {
  global.IntersectionObserver = class { constructor(){} observe(){} unobserve(){} disconnect(){} };
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

const baseGet = (url) => {
  if (url === '/tags' || url === '/crm/statuses' || url === '/templates') {
    return Promise.resolve({ data: { items: [] } });
  }
  if (url === '/inbox/conversations' || url === '/conversations') {
    return Promise.resolve({ data: { items: [
      { id: 1, contact: { name: 'Alice' }, channel: 'whatsapp' },
    ] } });
  }
  return Promise.resolve({ data: {} });
};

const renderPage = async () => {
  inboxApi.get.mockImplementation(baseGet);
  render(<MemoryRouter><InboxPage /></MemoryRouter>);
  await screen.findByTestId('conv-check-1');
};

describe('quick actions permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('agent limited actions', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 1, role: 'agent' }));
    await renderPage();
    fireEvent.click(screen.getByTestId('conv-check-1'));
    const assignBtn = screen.getByTestId('qa-assign-btn');
    const readBtn = screen.getByTestId('qa-read-btn');
    const archiveBtn = screen.getByTestId('qa-archive-btn');
    const closeBtn = screen.getByTestId('qa-close-btn');
    const spamBtn = screen.getByTestId('qa-spam-btn');
    expect(assignBtn).toBeEnabled();
    expect(readBtn).toBeEnabled();
    expect(archiveBtn).toBeDisabled();
    expect(closeBtn).toBeDisabled();
    expect(spamBtn).toBeDisabled();
    inboxApi.post.mockClear();
    fireEvent.click(archiveBtn);
    await waitFor(() => {});
    expect(inboxApi.post).not.toHaveBeenCalled();
  });

  test('supervisor without spam', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 2, role: 'supervisor' }));
    await renderPage();
    fireEvent.click(screen.getByTestId('conv-check-1'));
    expect(screen.getByTestId('qa-assign-btn')).toBeEnabled();
    expect(screen.getByTestId('qa-read-btn')).toBeEnabled();
    expect(screen.getByTestId('qa-archive-btn')).toBeEnabled();
    expect(screen.getByTestId('qa-close-btn')).toBeEnabled();
    expect(screen.getByTestId('qa-spam-btn')).toBeDisabled();
  });

  test('org_admin all actions', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 3, role: 'org_admin' }));
    await renderPage();
    fireEvent.click(screen.getByTestId('conv-check-1'));
    expect(screen.getByTestId('qa-assign-btn')).toBeEnabled();
    expect(screen.getByTestId('qa-read-btn')).toBeEnabled();
    expect(screen.getByTestId('qa-archive-btn')).toBeEnabled();
    expect(screen.getByTestId('qa-close-btn')).toBeEnabled();
    expect(screen.getByTestId('qa-spam-btn')).toBeEnabled();
  });
});
