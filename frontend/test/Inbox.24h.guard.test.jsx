import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import InboxPage from '../src/pages/inbox/InboxPage.jsx';
import inboxApi from '../src/api/inboxApi.js';
import { renderWithRouterProviders } from './utils/renderWithRouterProviders.jsx';

jest.mock('../src/components/inbox/ChannelPicker.jsx', () => ({ __esModule: true, default: () => null }));

inboxApi.get.mockImplementation((url) => {
  if (url === '/inbox/conversations') return Promise.resolve({ data: { items:[{ id:1, channel:'instagram', client_name:'IG', account_id:'ig1' }] } });
  if (url === '/inbox/conversations/1/messages') return Promise.resolve({ data: { items:[] } });
  if (url === '/channels/meta/accounts') return Promise.resolve({ data: { items:[{ id:'ig1', name:'IG Acc' }] } });
  return Promise.resolve({ data:{} });
});

beforeEach(() => {
  inboxApi.post.mockReset();
});

test('composer disables when outside 24h', async () => {
  inboxApi.post.mockImplementation((url, body) => {
    if (url === '/inbox/messages' || url?.includes('/inbox/messages')) {
      return Promise.reject({ response:{ data:{ error:'outside_24h' } } });
    }
    return Promise.resolve({ data:{} });
  });
  renderWithRouterProviders(<InboxPage />, { org: { selected:'o1', orgs:[{id:'o1', name:'Org'}] } });
  const row = await screen.findByTestId('conv-item-1');
  fireEvent.click(row);
  await screen.findByTestId('composer-text');
  fireEvent.change(screen.getByTestId('composer-text'), { target:{ value:'hi' } });
  fireEvent.click(screen.getByTestId('composer-send'));
  await waitFor(() => expect(inboxApi.post).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByTestId('composer-text')).toBeDisabled());
  const lockedButton = screen.getByTestId('composer-locked');
  expect(lockedButton).toBeDisabled();
});
