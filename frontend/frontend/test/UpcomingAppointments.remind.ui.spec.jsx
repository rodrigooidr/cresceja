import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UpcomingAppointments from '@/pages/inbox/components/UpcomingAppointments';
import inboxApi from '@/api/inboxApi';

jest.mock('@/api/inboxApi');

describe('UpcomingAppointments remind UX', () => {
  const item = { id: 'e1', title: 'Consulta', start_at: new Date().toISOString(), customer: { whatsapp: '+5541' } };

  test('loading → sucesso → botão desabilita', async () => {
    inboxApi.post.mockResolvedValueOnce({ data: { idempotent: false } });
    render(<UpcomingAppointments items={[item]} />);
    const btn = screen.getByRole('button', { name: /enviar/i });
    fireEvent.click(btn);
    expect(btn).toBeDisabled();
    await waitFor(() => expect(btn).toHaveTextContent(/aguardando|enviando/i));
  });

  test('429 mostra erro e reabilita', async () => {
    inboxApi.post.mockRejectedValueOnce({ response: { status: 429 } });
    render(<UpcomingAppointments items={[{ ...item, id: 'e2' }]} />);
    const btn = screen.getByRole('button', { name: /enviar/i });
    fireEvent.click(btn);
    await waitFor(() => expect(btn).not.toBeDisabled());
  });
});
