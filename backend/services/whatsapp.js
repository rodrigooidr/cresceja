// services/whatsapp.js
// Suporte a dois provedores: 'meta' (WhatsApp Cloud API) e 'twilio' (Twilio WhatsApp)
// Inclui envio de mensagens de texto e envio de mensagens de TEMPLATE (HSM) para iniciadas pela empresa.

import axios from 'axios';
let twilioClient = null;

const PROVIDER = process.env.WHATSAPP_PROVIDER || 'meta'; // 'meta' | 'twilio'

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
      name: templateName, // ex: 'agendamento_confirmacao'
      language: { code: languageCode }, // ex: 'pt_BR'
      components // ex: [{ type:'body', parameters:[{ type:'text', text:'Rodrigo' }, ...]}]
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
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const auth = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM; // ex: 'whatsapp:+14155238886'
  if (!sid || !auth || !from) {
    throw new Error('Config Twilio ausente: defina TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN e TWILIO_WHATSAPP_FROM');
  }
  if (!twilioClient) twilioClient = import 'twilio';(sid, auth);
  const res = await twilioClient.messages.create({
    from,
    to: normalizeForTwilio(toNumber),
    body: message
  });
  return res;
}

async function sendWhatsApp(toNumber, message) {
  if (!toNumber) throw new Error('Número de WhatsApp do destinatário ausente');
  if (PROVIDER === 'twilio') return sendViaTwilio(toNumber, message);
  // padrão: META Cloud API
  return sendViaMeta(toNumber, message);
}

export default { sendWhatsApp, sendTemplateMeta, normalizeToE164, PROVIDER };