import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { MetaAccounts } from '../src/pages/settings/FacebookSection.jsx';
import inboxApi from '../src/api/inboxApi.js';

describe('Settings Meta backfill action', () => {
  beforeEach(() => {
    inboxApi.__mockMetaReset?.();
    inboxApi.__seedMetaAccounts?.([
      { id: 'fb1', channel: 'facebook', external_account_id: 'PAGE1', name: 'Page One' },
    ]);
    window.toast = jest.fn();
  });

  test('clicking backfill triggers API call and toast', async () => {
    render(<MetaAccounts channel="facebook" />);

    const row = await screen.findByTestId('facebook-acc-fb1');
    const button = within(row).getByRole('button', { name: /Backfill \(24h\)/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(window.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Backfill iniciado' })
      );
    });

    const lastRequest = inboxApi.__getLastRequest?.();
    expect(lastRequest).toMatchObject({
      url: '/channels/meta/accounts/fb1/backfill',
      params: { hours: 24 },
    });
  });
});
