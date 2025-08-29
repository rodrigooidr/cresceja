import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import ChannelsPage from '../pages/settings/ChannelsPage';
import { setBaileysAllowed } from './channels.summary.msw';

describe('Baileys permissions', () => {
  it('hides card when not allowed', async () => {
    setBaileysAllowed(false);
    render(<ChannelsPage />);
    await screen.findByTestId('card-wa-official');
    expect(screen.queryByTestId('card-wa-baileys')).toBeNull();
  });

  it('shows connect when allowed', async () => {
    setBaileysAllowed(true);
    render(<ChannelsPage />);
    await screen.findByTestId('card-wa-official');
    expect(screen.getByTestId('baileys-connect-cta')).toBeInTheDocument();
  });
});
