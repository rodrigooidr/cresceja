import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import ChannelsPage from '../pages/settings/ChannelsPage';

describe('Baileys wizard', () => {
  it('connects via QR', async () => {
    render(<ChannelsPage />);
    const btn = await screen.findByTestId('baileys-connect-cta');
    btn.click();
    await screen.findByTestId('baileys-qr-img');
    // wait until wizard closes (polling connects)
    await waitFor(() => expect(screen.queryByTestId('baileys-qr-img')).toBeNull());
    await screen.findByText(/connected/);
  });
});
