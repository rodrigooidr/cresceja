import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChannelPicker from '../src/components/ChannelPicker.jsx';

const options = [
  { value: '1', label: 'Canal 1' },
  { value: '2', label: 'Canal 2' },
];

test('abre a lista e permite selecionar opção', async () => {
  jest.useRealTimers();
  const handleChange = jest.fn();
  const user = userEvent.setup();
  render(<ChannelPicker value="" onChange={handleChange} options={options} />);

  const combo = screen.getByTestId('channel-combobox');
  await user.click(combo);
  const list = await screen.findByRole('listbox');
  expect(list).toBeInTheDocument();

  const opt = screen.getByTestId('channel-option-2');
  await user.click(opt);
  expect(handleChange).toHaveBeenCalledWith('2');
  expect(screen.queryByRole('listbox')).toBeNull();
});
