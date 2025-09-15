import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OrgCreateModal from '../src/pages/admin/organizations/OrgCreateModal';

test('exibe erro em vermelho quando CNPJ é inválido', async () => {
  render(<OrgCreateModal open onClose={() => {}} />);
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await user.click(screen.getByRole('button', { name: /Salvar/i }));
  await actTick();
  const err = screen.getByTestId('cnpj-error');
  expect(err).toBeInTheDocument();
  expect(err).toHaveClass('text-red-600');
  expect(screen.getByLabelText(/CNPJ/i)).toHaveAttribute('aria-invalid', 'true');
});
