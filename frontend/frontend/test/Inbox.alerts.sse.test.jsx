/**
 * Testa: ao receber um evento SSE "alert", a lista mostra o UrgentBadge.
 */
import React from 'react';
import { render, screen, act } from '@testing-library/react';

let instances = [];

class MockES {
  constructor() {
    this.handlers = {};
    instances.push(this);
    setTimeout(() => this.emit('ping', {}), 0);
  }
  addEventListener(type, cb) {
    this.handlers[type] = cb;
  }
  close() {}
  emit(type, data) {
    const handler = this.handlers[type];
    if (handler) {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      handler({ data: payload });
    }
  }
}

global.EventSource = MockES;
global.Audio = function () {
  return { play: () => Promise.resolve(), volume: 1 };
};

delete global.fetch;

import { useInboxAlerts } from '@/pages/inbox/hooks/useInboxAlerts';
import UrgentBadge from '@/pages/inbox/components/UrgentBadge';

function DemoList() {
  const { pending } = useInboxAlerts();
  const has = pending.has('conv-1');
  return <div>{has ? <UrgentBadge /> : <span>sem alerta</span>}</div>;
}

test('aparece badge quando chega alerta SSE', async () => {
  instances = [];
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) });
  global.fetch = fetchMock;

  render(<DemoList />);
  expect(screen.getByText(/sem alerta/i)).toBeInTheDocument();

  await act(async () => {
    jest.runAllTimers();
    await Promise.resolve();
  });

  const es = instances[0];
  expect(es).toBeDefined();

  await act(async () => {
    es.emit('alert', { conversationId: 'conv-1', at: new Date().toISOString() });
    jest.runAllTimers();
    await Promise.resolve();
  });

  expect(document.querySelector('[aria-label="Atendimento humano solicitado"]')).toBeTruthy();
});
