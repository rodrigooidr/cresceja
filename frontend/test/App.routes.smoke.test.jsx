import React from 'react';
import App from '../src/App.jsx';
import { renderWithRouterProviders } from './utils/renderWithRouterProviders';
import { screen } from '@testing-library/react';

jest.mock('../src/inbox/inbox.service.js', () => ({
  listConversations: jest.fn().mockResolvedValue({ items: [] }),
  getMessages: jest.fn().mockResolvedValue({ items: [] }),
  sendMessage: jest.fn().mockResolvedValue({}),
}));

jest.mock('../src/sockets/socket', () => ({
  useSocket: () => ({
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    removeAllListeners: jest.fn(),
    close: jest.fn(),
    disconnect: jest.fn(),
  }),
}));

test('landing abre em /', async () => {
  renderWithRouterProviders(<App />, { route: '/', user: null });
  expect(await screen.findByText(/Começar agora/i)).toBeInTheDocument();
});

test('inbox exige auth', async () => {
  renderWithRouterProviders(<App />, { route: '/inbox', user: null });
  expect(await screen.findByText(/Entrar/i)).toBeInTheDocument();
});

test('inbox com auth renderiza', async () => {
  renderWithRouterProviders(<App />, { route: '/inbox' });
  expect(await screen.findByLabelText(/Conversations/i)).toBeInTheDocument();
});
