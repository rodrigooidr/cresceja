import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import InboxPage from '../src/pages/inbox/InboxPage.jsx';
import inboxApi from '../src/api/inboxApi.js';
import { renderWithRouterProviders } from './utils/renderWithRouterProviders.jsx';

jest.mock('../src/components/inbox/ChannelPicker.jsx', () => ({ __esModule: true, default: () => null }));

const convs = [
  { id: 1, channel: 'whatsapp', client_name: 'WA' },
  { id: 2, channel: 'instagram', account_id: 'ig1', client_name: 'IG' },
  { id: 3, channel: 'facebook', account_id: 'fb1', client_name: 'FB' },
];

inboxApi.get.mockImplementation((url, { params } = {}) => {
  if (url === '/inbox/conversations') {
    let items = convs;
    if (params?.channel) items = items.filter(c => c.channel === params.channel);
    if (params?.accountId) items = items.filter(c => String(c.account_id) === String(params.accountId));
    return Promise.resolve({ data: { items } });
  }
  if (url === '/channels/meta/accounts') {
    if (params.channel === 'instagram') return Promise.resolve({ data: { items: [{ id:'ig1', name:'IG Acc' }] } });
    if (params.channel === 'facebook') return Promise.resolve({ data: { items: [{ id:'fb1', name:'FB Acc' }] } });
  }
  return Promise.resolve({ data: { items: [] } });
});

beforeEach(() => {
  inboxApi.get.mockClear();
});

test('filter by channel and account', async () => {
  renderWithRouterProviders(<InboxPage />, { org: { selected: 'o1', orgs:[{id:'o1', name:'Org'}] } });
  expect(await screen.findByTestId('conv-item-1')).toBeInTheDocument();

  const channelSelect = screen.getByTestId('channel-filter');
  fireEvent.change(channelSelect, { target:{ value:'instagram' } });
  await waitFor(() => expect(screen.queryByTestId('conv-item-1')).toBeNull());
  expect(channelSelect.value).toBe('instagram');
  expect(await screen.findByTestId('conv-item-2')).toBeInTheDocument();

  const accSelect = await screen.findByTestId('account-filter');
  fireEvent.change(accSelect, { target:{ value:'ig1' } });
  await waitFor(() => expect(inboxApi.get).toHaveBeenCalledWith('/inbox/conversations', expect.objectContaining({ params: expect.objectContaining({ channel:'instagram', accountId:'ig1' }) }))); 
});
