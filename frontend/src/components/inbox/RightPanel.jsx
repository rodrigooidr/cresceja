import { useEffect, useState } from 'react';
import inboxApi from '../../api/inboxApi.js';

export default function RightPanel({ conversation }) {
  const [contact, setContact] = useState(null);

  useEffect(() => {
    setContact({
      display_name: conversation.display_name,
      phone: conversation.phone,
      cpf: conversation.cpf,
      id: conversation.contact_id,
    });
  }, [conversation]);

  const save = async (field, value) => {
    setContact((c) => ({ ...c, [field]: value }));
    await inboxApi.patch(`/contacts/${conversation.contact_id}`, { [field]: value }).catch(() => {});
  };

  if (!contact) return null;

  return (
    <div className="p-4 space-y-2">
      <div className="text-lg font-semibold">Perfil</div>
      <input
        className="w-full border p-1 rounded"
        value={contact.display_name || ''}
        onChange={(e) => save('display_name', e.target.value)}
        placeholder="Nome"
      />
      <input
        className="w-full border p-1 rounded"
        value={contact.phone || ''}
        onChange={(e) => save('phone', e.target.value)}
        placeholder="Telefone"
      />
      <input
        className="w-full border p-1 rounded"
        value={contact.cpf || ''}
        onChange={(e) => save('cpf', e.target.value)}
        placeholder="CPF"
      />
    </div>
  );
}
