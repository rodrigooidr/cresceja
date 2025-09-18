export class ProviderNotConfigured extends Error {
  constructor() {
    super('WHATSAPP_NOT_CONFIGURED');
    this.name = 'ProviderNotConfigured';
    this.code = 'WHATSAPP_NOT_CONFIGURED';
  }
}

export async function sendWhatsApp(to, text, ctx = {}) {
  if (!process.env.WHATSAPP_PROVIDER || process.env.WHATSAPP_PROVIDER === 'none') {
    throw new ProviderNotConfigured();
  }

  return { provider_message_id: `mock-${Date.now()}` };
}

export default { sendWhatsApp, ProviderNotConfigured };
