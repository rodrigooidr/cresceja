/* ADD-ONLY */
import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('@/auth/permCompat', () => ({
  hasPerm: (p) => ({ 'inbox:view': true, 'audit:view': false, 'telemetry:view': false, 'marketing:view': true }[p] ?? false),
}));

// ajuste o caminho do componente se necessário:
import Sidebar from '@/components/Sidebar';

describe('Sidebar por permissão', () => {
  test('exibe/oculta links conforme RBAC', () => {
    render(<Sidebar />);
    expect(screen.getByRole('link', { name: /Inbox/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Calendário$/i })).toBeInTheDocument();
    expect(screen.queryByText(/Governança/i)).toBeNull();
    expect(screen.queryByText(/Métricas/i)).toBeNull();
  });
});
