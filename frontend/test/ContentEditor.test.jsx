import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ContentEditor from '../src/components/ContentEditor.jsx';

test('usa textarea no ambiente de teste', async () => {
  const handleChange = jest.fn();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  render(<ContentEditor value="" onChange={handleChange} />);
  const area = screen.getByTestId('content-editor');
  await user.type(area, 'Olá');
  expect(handleChange).toHaveBeenLastCalledWith('Olá');
});
