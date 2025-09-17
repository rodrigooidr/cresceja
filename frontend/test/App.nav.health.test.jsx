/* ADD-ONLY */
import React from 'react';
import { render, screen } from '@testing-library/react';
import AppRoutes from '@/routes/AppRoutes';

beforeAll(() => {
  if (typeof global.EventSource !== 'function') {
    global.EventSource = class {
      constructor() {
        this.addEventListener = jest.fn();
        this.close = jest.fn();
      }
    };
  }
});

function Harness({ initial = '/inbox' }) {
  const routes = Array.isArray(AppRoutes) ? AppRoutes : AppRoutes.routes || [];
  const match = routes.find((r) => r.path === initial) || routes.find((r) => r.path === '*');
  return match ? match.element : null;
}

describe('Navegação básica', () => {
  test('abre /inbox sem crash', () => {
    render(<Harness initial="/inbox" />);
    // heurísticas que devem existir na sua Inbox
    const hints = [/Inbox/i, /Conversas/i, /WhatsApp/i];
    expect(hints.some((rx) => screen.queryByText(rx))).toBe(true);
  });
});
