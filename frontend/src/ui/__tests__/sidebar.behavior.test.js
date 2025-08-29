import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../../ui/layout/Sidebar';

test('sidebar inicia colapsada e expande no hover', () => {
  render(<MemoryRouter><Sidebar/></MemoryRouter>);
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
