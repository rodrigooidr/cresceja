import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import FacebookSection from '../src/pages/settings/FacebookSection.jsx';
import inboxApi from '../src/api/inboxApi.js';
import { openOAuth } from '../src/utils/oauthDriver.js';
import { renderWithRouterProviders } from './utils/renderWithRouterProviders.jsx';

jest.mock('../src/utils/oauthDriver.js', () => ({
  openOAuth: jest.fn(),
}));

beforeEach(() => {
  openOAuth.mockReset();
});

test('connect real flow loads accounts and allows subscribing', async () => {
  openOAuth.mockImplementation(async ({ onSuccess }) => {
    onSuccess({ userAccessToken: 'REAL_USER_TOKEN' });
    return { close: () => {} };
  });

  renderWithRouterProviders(<FacebookSection />, {
    org: { selected: 'org_test', orgs: [{ id: 'org_test', name: 'Org' }] },
  });

  const connectBtn = await screen.findByTestId('facebook-connect-btn');
  fireEvent.click(connectBtn);

  await waitFor(() => {
    expect(openOAuth).toHaveBeenCalled();
  });
  await waitFor(() => {
    expect(inboxApi.post).toHaveBeenCalledWith('/channels/meta/accounts/connect', { userAccessToken: 'REAL_USER_TOKEN' });
  });

  await screen.findByTestId('facebook-acc-fb1');

  const subscribeBtn = screen.getByTestId('facebook-sub-fb1');
  fireEvent.click(subscribeBtn);
  await waitFor(() => {
    expect(inboxApi.post).toHaveBeenCalledWith('/channels/meta/accounts/fb1/subscribe');
  });
});
