import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OrgCreateModal from '../src/pages/admin/organizations/OrgCreateModal';

test('exibe erro em vermelho quando CNPJ é inválido', async () => {
  render(<OrgCreateModal open onClose={() => {}} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /Salvar/i }));
  const cnpjInput = screen.getByLabelText(/CNPJ/i);
  expect(cnpjInput).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByText('CNPJ inválido')).toBeInTheDocument();
});
