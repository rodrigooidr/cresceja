import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChannelsPage from '../pages/settings/ChannelsPage';

describe('WhatsApp official', () => {
  it('adds, verifies and removes number', async () => {
    render(<ChannelsPage />);
    const add = await screen.findByTestId('waof-add-number');
    add.click();
    await screen.findByTestId('wizard-dialog');
    fireEvent.change(screen.getByPlaceholderText('Label'), { target: { value: 'Comercial' } });
    fireEvent.change(screen.getByPlaceholderText('Telefone'), { target: { value: '+5511' } });
    screen.getByTestId('wizard-finish').click();
    await screen.findByText(/verifying/);
    screen.getByTestId('waof-verify').click();
    await screen.findByTestId('wizard-dialog');
    fireEvent.change(screen.getByPlaceholderText('Código'), { target: { value: '123456' } });
    screen.getByTestId('wizard-finish').click();
    await screen.findByText(/connected/);
    screen.getByTestId('waof-remove').click();
    await waitFor(() => expect(screen.queryByText(/connected/)).toBeNull());
  });
});
