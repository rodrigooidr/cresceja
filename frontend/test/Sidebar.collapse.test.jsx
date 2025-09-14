import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sidebar from '../src/ui/layout/Sidebar.jsx';
import { renderWithRouterProviders } from './utils/renderWithRouterProviders';

jest.mock('../src/auth/RequireAuth.jsx', () => ({ __esModule: true, default: ({ children }) => children }));
jest.mock('../src/hooks/ActiveOrgGate.jsx', () => ({ __esModule: true, default: ({ children }) => children }));

test('toggle and persist collapse', async () => {
  localStorage.removeItem('sidebar.collapsed');
  const user = userEvent.setup();
  const { unmount } = renderWithRouterProviders(<Sidebar />);
  const nav = screen.getByTestId('sidebar');
  expect(nav.className).toContain('w-72');
  await user.click(screen.getByTestId('collapse-toggle'));
  expect(nav.className).toContain('w-16');
  unmount();
  renderWithRouterProviders(<Sidebar />);
  expect(screen.getByTestId('sidebar').className).toContain('w-16');
});

