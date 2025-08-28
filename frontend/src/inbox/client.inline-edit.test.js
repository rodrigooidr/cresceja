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
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
  apiUrl: (x) => x,
}));

beforeEach(() => { jest.clearAllMocks(); });

function mockApis() {
  inboxApi.get.mockImplementation((url) => {
    if (url.includes('/messages')) return Promise.resolve({ data: { items: [] } });
    if (url.includes('/inbox/conversations') || url.includes('/conversations')) {
      return Promise.resolve({ data: { items: [{ id: 1, contact: { id: 'c1', name: 'Alice', phone_e164: '+5511999999999' } }] } });
    }
    return Promise.resolve({ data: {} });
  });
  inboxApi.put.mockResolvedValue({ data: { client: { id: 'c1', name: 'Alice A', phone_e164: '+5511999999999' } } });
  inboxApi.post.mockResolvedValue({ data: { client: { id: 'c1', name: 'Alice A', phone_e164: '+5511999999999' } } });
}

test('inline edit validates save and error', async () => {
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
  await screen.findByTestId('composer-text');

  const toggle = screen.getAllByTestId('client-edit-toggle')[0];
  await act(async () => { fireEvent.click(toggle); });
  const nameInput = screen.getByTestId('client-edit-name');
  fireEvent.change(nameInput, { target: { value: '' } });
  await act(async () => { fireEvent.click(screen.getByTestId('client-edit-save')); });
  expect(screen.getByText('nome obrigatório')).toBeInTheDocument();
  fireEvent.change(nameInput, { target: { value: 'Alice A' } });
  await act(async () => { fireEvent.click(screen.getByTestId('client-edit-save')); });
  expect(await screen.findByText('Contato atualizado')).toBeInTheDocument();

  const toggle2 = screen.getAllByTestId('client-edit-toggle')[0];
  await act(async () => { fireEvent.click(toggle2); });
  inboxApi.put.mockReset();
  inboxApi.put.mockImplementation(() => Promise.reject(new Error('fail')));
  const name2 = screen.getByTestId('client-edit-name');
  fireEvent.change(name2, { target: { value: 'Alice B' } });
  await act(async () => { fireEvent.click(screen.getByTestId('client-edit-save')); });
  expect(await screen.findByText('Erro ao atualizar contato')).toBeInTheDocument();
  expect(screen.getAllByTestId('client-edit-toggle')[0].textContent).toBe('Alice A');
});
