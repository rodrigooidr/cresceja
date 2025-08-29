import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import ChannelsPage from '../pages/settings/ChannelsPage';

describe('instagram and facebook', () => {
  it('connects and disconnects', async () => {
    render(<ChannelsPage />);
    await screen.findByTestId('card-wa-official');

    // Instagram
    screen.getByText('Instagram').click();
    const instaConnect = await screen.findByText('Conectar');
    instaConnect.click();
    await screen.findByText(/connected/);
    screen.getByText('Desconectar').click();
    await screen.findByText(/disconnected/);

    // Facebook
    screen.getByText('Facebook').click();
    const fbConnect = await screen.findByText('Conectar');
    fbConnect.click();
    await screen.findByText(/connected/);
    screen.getByText('Desconectar').click();
    await screen.findByText(/disconnected/);
  });
});
