import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../src/ui/layout/Sidebar.jsx';

jest.mock('../src/contexts/OrgContext.jsx', () => ({
  useOrg: () => ({
    selected: '1',
    publicMode: false,
    orgs: [],
    loading: false,
    setSelected: () => {},
    canSeeSelector: false,
  }),
  OrgProvider: ({ children }) => <>{children}</>,
}));
jest.mock('../src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'SuperAdmin' } }),
}));

test('toggle and persist collapse', async () => {
  localStorage.removeItem('sidebar.collapsed');
  const user = userEvent.setup();
  const { unmount } = render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>
  );
  const nav = screen.getByTestId('sidebar');
  expect(nav.className).toContain('w-72');
  await user.click(screen.getByTestId('collapse-toggle'));
  expect(nav.className).toContain('w-16');
  unmount();
  render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>
  );
  expect(screen.getByTestId('sidebar').className).toContain('w-16');
});

