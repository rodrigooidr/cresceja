import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FacebookSection from '../src/pages/settings/FacebookSection.jsx';

test('conectar via OAuth atalho em testes', async () => {
  jest.useRealTimers();
  const org = {
    channels: { facebook: { connected: false, permissions: [], pages: [] } },
    features: { facebook: true },
    plan: { limits: { facebook_pages: 1 } },
  };
  const user = userEvent.setup();
  render(<FacebookSection org={org} />);
  const btn = screen.getByTestId('fb-connect-btn');
  await user.click(btn);
  expect(btn.textContent).toMatch(/Reconectar/);
  expect(screen.queryByTestId('fb-perms-warning')).toBeNull();
  jest.useFakeTimers();
});
