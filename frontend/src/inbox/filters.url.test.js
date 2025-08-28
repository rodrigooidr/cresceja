import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

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
    inboxApi.get.mockImplementation((url) => {
      if (url === '/tags') {
        return Promise.resolve({ data: { items: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }] } });
      }
      if (url === '/crm/statuses') {
        return Promise.resolve({ data: { items: [{ id: 2, name: 'Open' }, { id: 3, name: 'Closed' }] } });
      }
      if (url === '/inbox/conversations' || url === '/conversations') {
        return Promise.resolve({ data: { items: [] } });
      }
      if (url.includes('/messages')) {
        return Promise.resolve({ data: { items: [] } });
      }
      return Promise.resolve({ data: {} });
    });
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
      <MemoryRouter initialEntries={['/inbox?search=foo&channels=whatsapp&tags=1&status=2']}>
        <Helpers />
        <InboxPage />
      </MemoryRouter>
    );

    const searchInput = await screen.findByTestId('filter-search');
    expect(searchInput).toHaveValue('foo');
    const whatsapp = screen.getByTestId('filter-channel-whatsapp');
    expect(whatsapp).toBeChecked();
    const tagSelect = screen.getByTestId('filter-tags');
    expect(Array.from(tagSelect.selectedOptions).map((o) => o.value)).toEqual(['1']);
    const statusSelect = screen.getByTestId('filter-status');
    expect(Array.from(statusSelect.selectedOptions).map((o) => o.value)).toEqual(['2']);

    fireEvent.change(searchInput, { target: { value: 'bar' } });
    await waitFor(() => {
      expect(currentSearch).toContain('search=bar');
    });

    fireEvent.click(whatsapp); // uncheck
    await waitFor(() => {
      expect(currentSearch).not.toContain('whatsapp');
    });

    await act(async () => {
      tagSelect.options[1].selected = true;
      fireEvent.change(tagSelect);
    });
    await waitFor(() => expect(decodeURIComponent(currentSearch)).toContain('tags=1,2'));

    await act(async () => {
      statusSelect.options[0].selected = false;
      statusSelect.options[1].selected = true;
      fireEvent.change(statusSelect);
    });
    await waitFor(() => expect(currentSearch).toContain('status=3'));
  });
});
