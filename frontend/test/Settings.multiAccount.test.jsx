import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import FacebookSection from '../src/pages/settings/FacebookSection.jsx';
import InstagramSection from '../src/pages/settings/InstagramSection.jsx';
import inboxApi from '../src/api/inboxApi.js';
import { renderWithRouterProviders } from './utils/renderWithRouterProviders.jsx';

inboxApi.get.mockImplementation((url, { params } = {}) => {
  if (url === '/channels/meta/accounts') {
    if (params.channel === 'facebook') return Promise.resolve({ data:{ items:[{ id:1, name:'FB1' }] } });
    if (params.channel === 'instagram') return Promise.resolve({ data:{ items:[{ id:2, name:'IG1' }] } });
  }
  return Promise.resolve({ data:{} });
});

beforeEach(() => {
  inboxApi.post.mockClear();
  inboxApi.delete.mockClear();
});

test('actions on accounts', async () => {
  renderWithRouterProviders(<>
    <FacebookSection />
    <InstagramSection />
  </>, { org:{ selected:'o1', orgs:[{id:'o1', name:'Org'}] } });

  const fbAcc = await screen.findByTestId('facebook-acc-1');
  fireEvent.click(screen.getByTestId('facebook-sub-1'));
  expect(inboxApi.post).toHaveBeenCalledWith(
    expect.stringMatching(/\/channels\/meta\/accounts\/1\/subscribe$/),
    expect.anything()
  );
  fireEvent.click(screen.getByTestId('facebook-del-1'));
  expect(inboxApi.delete).toHaveBeenCalledWith('/channels/meta/accounts/1');

  const igAcc = await screen.findByTestId('instagram-acc-2');
  fireEvent.click(screen.getByTestId('instagram-sub-2'));
  expect(inboxApi.post).toHaveBeenCalledWith(
    expect.stringMatching(/\/channels\/meta\/accounts\/2\/subscribe$/),
    expect.anything()
  );
});
