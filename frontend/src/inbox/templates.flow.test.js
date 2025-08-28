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
    if (url === '/tags' || url === '/crm/statuses') {
      return Promise.resolve({ data: { items: [] } });
    }
    if (url === '/templates') {
      return Promise.resolve({
        data: {
          items: [
            {
              id: 't1',
              name: 'Welcome',
              body: 'Hello {{name}} from {{product}}',
              variables: [
                { key: 'name', required: true },
                { key: 'product', required: false },
              ],
            },
          ],
        },
      });
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
  inboxApi.post.mockResolvedValue({ data: { message: { id: 'srv1', type: 'template', is_outbound: true } } });
}

describe('templates flow', () => {
  beforeEach(() => {
    mockApis();
  });
  afterEach(() => {
    jest.clearAllMocks();
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

  it('selects template, validates variables, previews and sends', async () => {
    await setup();
    const select = screen.getByTestId('template-select');
    fireEvent.change(select, { target: { value: 't1' } });

    const nameInput = await screen.findByTestId('template-var-name');
    const prodInput = screen.getByTestId('template-var-product');
    const sendBtn = screen.getByTestId('send-button');

    // required validation
    expect(sendBtn).toBeDisabled();
    expect(screen.getByText('Obrigatório')).toBeInTheDocument();

    fireEvent.change(nameInput, { target: { value: 'Alice' } });
    fireEvent.change(prodInput, { target: { value: 'Shop' } });
    expect(sendBtn).toBeEnabled();
    expect(screen.getByTestId('template-preview').textContent).toContain('Hello Alice');

    await act(async () => {
      fireEvent.click(sendBtn);
    });
    await waitFor(() => expect(inboxApi.post).toHaveBeenCalled());
    expect(inboxApi.post.mock.calls[0][1]).toMatchObject({
      type: 'template',
      template_id: 't1',
      variables: { name: 'Alice', product: 'Shop' },
    });
  });
});

