// services/whatsapp.js
// Suporte a dois provedores: 'meta' (WhatsApp Cloud API) e 'twilio' (Twilio WhatsApp)
// Inclui envio de mensagens de texto e envio de TEMPLATE (HSM) para conversas iniciadas pela empresa.

import axios from 'axios';

let twilioClientPromise = null;

export const PROVIDER = process.env.WHATSAPP_PROVIDER || 'meta'; // 'meta' | 'twilio'

function normalizeToE164(number) {
  if (!number) return null;
  let n = String(number).replace(/\D/g, '');
  if (!n.startsWith('+')) n = '+' + n;
  return n;
}

function normalizeForTwilio(number) {
  const e164 = normalizeToE164(number);
  return e164 ? `whatsapp:${e164}` : null;
}

// Carrega o client Twilio somente quando necessário
async function getTwilioClient() {
  if (twilioClientPromise) return twilioClientPromise;

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const auth = process.env.TWILIO_AUTH_TOKEN;

  if (!sid || !auth) {
    console.warn('[whatsapp] Twilio não configurado (faltam TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN).');
    return null;
  }

  twilioClientPromise = (async () => {
    // import dinâmico correto em ESM
    const twilio = (await import('twilio')).default;
    return twilio(sid, auth);
  })();

  return twilioClientPromise;
}

async function sendViaMeta(toNumber, message) {
  const token = process.env.WHATSAPP_TOKEN; // Long-Lived User Access Token
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID; // ID do número no Cloud API
  if (!token || !phoneNumberId) {
    throw new Error('Config WhatsApp META ausente: defina WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID');
  }

  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to: normalizeToE164(toNumber),
    type: 'text',
    text: { body: message }
  };

  const res = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  return res.data;
}

async function sendTemplateMeta(toNumber, templateName, languageCode = 'pt_BR', components = []) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    throw new Error('Config WhatsApp META ausente: defina WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID');
  }

  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to: normalizeToE164(toNumber),
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components
    }
  };

  const res = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  return res.data;
}

async function sendViaTwilio(toNumber, message) {
  const from = process.env.TWILIO_WHATSAPP_FROM; // ex: 'whatsapp:+14155238886'
  if (!from) {
    throw new Error('Config Twilio ausente: defina TWILIO_WHATSAPP_FROM');
  }

  const client = await getTwilioClient();
  if (!client) {
    throw new Error('Twilio não configurado (TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN ausentes).');
  }

  const to = normalizeForTwilio(toNumber);
  if (!to) throw new Error('Número de destino inválido para Twilio');

  const res = await client.messages.create({ from, to, body: message });
  return res;
}

export async function sendWhatsApp(toNumber, message) {
  if (!toNumber) throw new Error('Número de WhatsApp do destinatário ausente');
  if (PROVIDER === 'twilio') return sendViaTwilio(toNumber, message);
  return sendViaMeta(toNumber, message); // padrão: META Cloud API
}

export { sendTemplateMeta, normalizeToE164 };
export default { sendWhatsApp, sendTemplateMeta, normalizeToE164, PROVIDER };
