import React, { useState } from 'react';
import inboxApi from '../../api/inboxApi';
import ChannelCard from './ChannelCard';
import Dialog from './ChannelWizard/Dialog';

function WhatsAppOfficialCard({ data, refresh }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showVerify, setShowVerify] = useState(null); // id
  const max = data?.max_numbers || 0;
  const items = data?.items || [];

  const canAdd = items.length < max;

  async function handleAdd(e) {
    e.preventDefault();
    const form = e.target;
    const body = {
      label: form.label.value,
      phone_e164: form.phone.value,
    };
    await inboxApi.post('/channels/whatsapp/official/numbers', body);
    setShowAdd(false);
    refresh();
  }

  async function handleVerify(e) {
    e.preventDefault();
    const code = e.target.code.value;
    const id = showVerify;
    await inboxApi.post(`/channels/whatsapp/official/numbers/${id}/verify`, { code });
    setShowVerify(null);
    refresh();
  }

  async function handleRemove(id) {
    await inboxApi.delete(`/channels/whatsapp/official/numbers/${id}`);
    refresh();
  }

  return (
    <ChannelCard title="WhatsApp Oficial" testId="card-wa-official">
      <ul>
        {items.map((n) => (
          <li key={n.id} className="mb-1">
            {n.label} - {n.phone_e164} ({n.status})
            {n.status !== 'connected' && (
              <button
                data-testid="waof-verify"
                className="ml-2 text-blue-600"
                onClick={() => setShowVerify(n.id)}
              >
                Verificar
              </button>
            )}
            <button
              data-testid="waof-remove"
              className="ml-2 text-red-600"
              onClick={() => handleRemove(n.id)}
            >
              Remover
            </button>
          </li>
        ))}
      </ul>
      <button
        data-testid="waof-add-number"
        disabled={!canAdd}
        className="mt-2 px-3 py-1 bg-blue-500 text-white disabled:opacity-50"
        onClick={() => setShowAdd(true)}
      >
        Adicionar número
      </button>

      {showAdd && (
        <Dialog onClose={() => setShowAdd(false)}>
          <form onSubmit={handleAdd} className="space-y-2">
            <input name="label" placeholder="Label" className="border p-1 w-full" />
            <input name="phone" placeholder="Telefone" className="border p-1 w-full" />
            <button data-testid="wizard-finish" type="submit" className="px-3 py-1 bg-blue-500 text-white">
              Salvar
            </button>
          </form>
        </Dialog>
      )}

      {showVerify && (
        <Dialog onClose={() => setShowVerify(null)}>
          <form onSubmit={handleVerify} className="space-y-2">
            <input name="code" placeholder="Código" className="border p-1 w-full" />
            <button data-testid="wizard-finish" type="submit" className="px-3 py-1 bg-blue-500 text-white">
              Verificar
            </button>
          </form>
        </Dialog>
      )}
    </ChannelCard>
  );
}

export default WhatsAppOfficialCard;
