/**
 * Testa: clicar ACK chama POST /api/inbox/alerts/:id/ack e remove o alerta do estado.
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

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
import HandoffBanner from '@/pages/inbox/components/HandoffBanner';

function DemoChat() {
  const { pending, ack } = useInboxAlerts();
  const show = pending.size > 0;
  return <HandoffBanner show={show} onAck={() => ack('conv-ack')} />;
}

test('ACK chama POST e resolve sem erro', async () => {
  instances = [];
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          {
            conversation_id: 'conv-ack',
            at: new Date().toISOString(),
          },
        ],
      }),
    })
    .mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  global.fetch = fetchMock;

  render(<DemoChat />);

  await act(async () => {
    jest.runAllTimers();
    await Promise.resolve();
  });

  const btn = await screen.findByRole('button', { name: /confirmar/i });
  await act(async () => {
    fireEvent.click(btn);
    jest.runAllTimers();
    await Promise.resolve();
  });

  expect(global.fetch).toHaveBeenCalledWith('/api/inbox/alerts/conv-ack/ack', { method: 'POST' });
});
