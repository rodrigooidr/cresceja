import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';

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

describe('filters and URL sync', () => {
  beforeEach(() => {
    inboxApi.get.mockResolvedValue({ data: { items: [] } });
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('updates URL when filters change and reads from URL', async () => {
    let currentSearch = '';
    function Helpers() {
      currentSearch = useLocation().search;
      return null;
    }
    render(
      <MemoryRouter initialEntries={['/inbox?search=foo&channels=whatsapp']}>
        <Helpers />
        <InboxPage />
      </MemoryRouter>
    );

    const searchInput = await screen.findByPlaceholderText('Pesquisar');
    expect(searchInput).toHaveValue('foo');
    const whatsapp = screen.getByLabelText('whatsapp');
    expect(whatsapp).toBeChecked();

    fireEvent.change(searchInput, { target: { value: 'bar' } });
    await waitFor(() => {
      expect(currentSearch).toContain('search=bar');
    });

    fireEvent.click(whatsapp); // uncheck
    await waitFor(() => {
      expect(currentSearch).not.toContain('whatsapp');
    });
  });
});
