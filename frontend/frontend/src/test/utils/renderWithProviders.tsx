import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Se usar provedores reais, importe-os aqui (AuthProvider/OrgProvider) e passe mocks via props se precisar.
// Por ora, como o gate está mockado, podemos simplificar:
export function renderWithProviders(ui: React.ReactElement, { route = '/' } = {}) {
  const utils = render(
    <MemoryRouter initialEntries={[route]}>
      {ui}
    </MemoryRouter>
  );
  return { ...utils, screen };
}
