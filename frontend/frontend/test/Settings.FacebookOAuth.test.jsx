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

test('connect accepts accounts payload from OAuth driver', async () => {
  openOAuth.mockImplementation(async ({ onSuccess }) => {
    onSuccess({
      accounts: [
        {
          external_account_id: 'manual_page',
          name: 'Manual Page',
          access_token: 'MANUAL_ACCESS',
        },
      ],
    });
    return { close: () => {} };
  });

  renderWithRouterProviders(<FacebookSection />, {
    org: { selected: 'org_manual', orgs: [{ id: 'org_manual', name: 'Org Manual' }] },
  });

  const connectBtn = await screen.findByTestId('facebook-connect-btn');
  fireEvent.click(connectBtn);

  await waitFor(() => {
    expect(openOAuth).toHaveBeenCalled();
  });
  await waitFor(() => {
    expect(inboxApi.post).toHaveBeenCalledWith('/channels/meta/accounts/connect', {
      accounts: [
        {
          external_account_id: 'manual_page',
          name: 'Manual Page',
          access_token: 'MANUAL_ACCESS',
          channel: 'facebook',
        },
      ],
    });
  });
});
