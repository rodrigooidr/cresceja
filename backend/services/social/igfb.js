// backend/services/social/igfb.js
import { saveInboundMessage } from './shared.js';
import { downloadMediaToAsset } from '../socialHelpers.js';

export async function sendMessage({ orgId, conversationId, text }) {
  // stub de envio para Instagram/Facebook
  // integrar Graph API conforme necessário
  return { ok: true };
}

export async function handleWebhook(provider, payload) {
  // parse básico de IG/FB Messaging -> normalizar e chamar saveInboundMessage
  // (implementar mapeamento conforme Graph API)
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const messaging = change.value?.messages || [];
      for (const m of messaging) {
        await saveInboundMessage({
          provider,
          providerMessage: m,
          orgHint: null,
          mediaDownloader: downloadMediaToAsset
        });
      }
    }
  }
}
