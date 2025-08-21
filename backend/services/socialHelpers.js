// backend/services/socialHelpers.js
import { pool } from '../config/db.js';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';

export async function upsertContactAndConversation(provider, providerMessage, orgHint) {
  // Extrair external_id (ex.: número WA), nome e possível org a partir do channel config
  // Aqui você pode mapear pelo phone_id/token -> org_id; por simplicidade, assuma uma org (stub) ou busque channel por metadata no DB.

  // ... obter orgId + channelId (SELECT em channels por credencial/phone_id)
  // ... criar/achar contact por (org_id, platform, external_id)
  // ... criar/achar conversation aberta por (org_id, channel_id, contact_id)

  return { orgId: '<org-uuid>', conversationId: 123, contactId: '<contact-uuid>' }; // preencher de verdade
}

export async function downloadMediaToAsset({ orgId, url, kind, filename }) {
  // baixar mídia e salvar no storage configurado; registrar em assets e retornar asset_id
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  const id = uuidv4();
  // salvar em disco/S3 conforme sua infra; registre em assets (org_id, kind, path, meta)
  return id; // asset_id
}

export async function persistInboundMessage({ orgId, conversationId, provider, providerMessage, mediaDownloader }) {
  // Normalizar texto e anexos (image/file/audio), baixar mídia quando necessário e salvar em message_attachments
  // Inserir em messages (direction='in', status='delivered' por ex.)
  // Se áudio: enfileirar transcrição (content:transcribe)
  return { messageId: 1, textNormalized: '...texto...' };
}
