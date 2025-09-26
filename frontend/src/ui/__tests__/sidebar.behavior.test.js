import { fireEvent } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/utils/renderWithProviders';
import Sidebar from '../../ui/layout/Sidebar';
import { AuthContext } from '../../contexts/AuthContext';

function renderSidebar(user) {
  return renderWithProviders(
    <AuthContext.Provider value={{ user, logout: jest.fn(), token: 'test-token', isAuthenticated: true }}>
      <Sidebar />
    </AuthContext.Provider>
  );
}

test('sidebar inicia colapsada e expande no hover', () => {
  const { screen } = renderSidebar({ role: 'OrgOwner', roles: ['SuperAdmin'] });
  const sb = screen.getByTestId('sidebar');
  // colapsado: não deve renderizar labels de texto
  expect(sb).toBeInTheDocument();
  expect(screen.queryByText(/Configurações/i)).toBeNull();

  // mouse enter -> expande e mostra label
  fireEvent.mouseEnter(sb);
  expect(screen.getByText(/Configurações/i)).toBeInTheDocument();

  // mouse leave -> colapsa
  fireEvent.mouseLeave(sb);
  expect(screen.queryByText(/Configurações/i)).toBeNull();
});

test('admin menu aparece apenas para SuperAdmin', () => {
  const { screen, rerender } = renderSidebar({ role: 'OrgAdmin', roles: [] });
  expect(screen.queryByText(/Organizações \/ Clientes/i)).not.toBeInTheDocument();

  rerender(
    <AuthContext.Provider value={{ user: { role: 'OrgOwner', roles: ['SuperAdmin'] }, logout: jest.fn(), token: 'test', isAuthenticated: true }}>
      <Sidebar />
    </AuthContext.Provider>
  );

  expect(screen.getByText(/Organizações \/ Clientes/i)).toBeInTheDocument();
});
