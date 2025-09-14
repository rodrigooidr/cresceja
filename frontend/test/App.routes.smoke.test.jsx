import React from 'react';
import App from '../src/App.jsx';
import { renderWithRouterProviders } from './utils/renderWithRouterProviders';
import { screen } from '@testing-library/react';

jest.mock('../src/inbox/inbox.service.js', () => ({
  listConversations: jest.fn().mockResolvedValue({ items: [] }),
  getMessages: jest.fn().mockResolvedValue({ items: [] }),
  sendMessage: jest.fn().mockResolvedValue({}),
  listTemplates: jest.fn().mockResolvedValue([]),
  listQuickReplies: jest.fn().mockResolvedValue([]),
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
  window.history.pushState({}, '', '/');
  renderWithRouterProviders(<App />, { withRouter: false, user: null });
  expect(await screen.findAllByText(/bem-vindo|login|entrar|começar/i)).toBeTruthy();
});

test('inbox exige auth', async () => {
  window.history.pushState({}, '', '/inbox');
  renderWithRouterProviders(<App />, { withRouter: false, user: null });
  expect(await screen.findAllByText(/login|entrar/i)).toBeTruthy();
});

test('inbox com auth renderiza', async () => {
  window.history.pushState({}, '', '/inbox');
  renderWithRouterProviders(<App />, { withRouter: false });
  expect(await screen.findByLabelText(/Conversations/i)).toBeInTheDocument();
});
