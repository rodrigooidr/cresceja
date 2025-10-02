// Stub de envio via WhatsApp Cloud (para desenvolvimento/teste)
export async function sendWhatsappMessage({ to, text }) {
  if (!to || !text) return { ok: false, error: 'missing_fields' };
  // Aqui apenas “fingimos” enviar e retornamos ok=true.
  return { ok: true, id: `mock_${Date.now()}`, to, text };
}

export async function handleWebhook(_db, payload) {
  // Stub que apenas retorna ok, simulando processamento assíncrono
  return { ok: true, payload }; // eslint-disable-line object-shorthand
}
