import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import ChannelsPage from '../pages/settings/ChannelsPage';
import { addOfficialNumber, addBaileysSession } from './channels.summary.msw';

describe('channel limits', () => {
  it('disables actions when limits reached', async () => {
    addOfficialNumber({ id: 'n1', label: 'n1', phone_e164: '+1', status: 'connected' });
    addOfficialNumber({ id: 'n2', label: 'n2', phone_e164: '+2', status: 'connected' });
    addBaileysSession({ id: 's1', label: 's1', status: 'connected' });
    render(<ChannelsPage />);
    const addBtn = await screen.findByTestId('waof-add-number');
    expect(addBtn).toBeDisabled();
    const qrBtn = await screen.findByTestId('baileys-connect-cta');
    expect(qrBtn).toBeDisabled();
  });
});
