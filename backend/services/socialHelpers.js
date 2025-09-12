// backend/services/socialHelpers.js
import { query as rootQuery } from '#db';
import { v4 as uuidv4 } from 'uuid';

const q = (db) => (db && db.query) ? (t,p)=>db.query(t,p) : (t,p)=>rootQuery(t,p);

export async function upsertContactAndConversation(db, provider, providerMessage, orgHint) {
  const client = db;
  try {
    await client.query('BEGIN');

    // descobrir channel/org a partir do orgHint/credencial
    let channelRow;
    if (provider === 'wa_cloud' || provider === 'whatsapp') {
      const phoneId = orgHint || providerMessage?.phone_number_id || providerMessage?.metadata?.phone_number_id;
      const { rows } = await client.query(
        `SELECT org_id, id FROM channels WHERE kind='whatsapp' AND settings->>'phone_number_id'=$1`,
        [phoneId]
      );
      channelRow = rows[0];
    } else if (provider === 'instagram' || provider === 'facebook') {
      const pageId = orgHint || providerMessage?.page_id;
      const { rows } = await client.query(
        `SELECT org_id, id FROM channels WHERE kind=$1 AND settings->>'page_id'=$2`,
        [provider, pageId]
      );
      channelRow = rows[0];
    }

    if (!channelRow) throw new Error('channel_not_found');
    const orgId = channelRow.org_id;
    const channelId = channelRow.id;

    // dados do contato
    const externalId = providerMessage.from || providerMessage.sender?.id || providerMessage.user_id;
    const name = providerMessage.profile?.name || providerMessage.name || externalId;
    const photoAssetId = providerMessage.profile?.photo_asset_id || null;

    const contactRes = await client.query(
      `INSERT INTO contacts (org_id, platform, external_id, display_name, photo_asset_id)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (org_id, platform, external_id)
         DO UPDATE SET display_name=EXCLUDED.display_name,
                       photo_asset_id=COALESCE(EXCLUDED.photo_asset_id, contacts.photo_asset_id)
         RETURNING id`,
      [orgId, provider, externalId, name, photoAssetId]
    );
    const contactId = contactRes.rows[0].id;

    // conversa aberta
    const convSel = await client.query(
      `SELECT id FROM conversations WHERE org_id=$1 AND channel_id=$2 AND contact_id=$3 AND status='open' LIMIT 1`,
      [orgId, channelId, contactId]
    );
    let conversationId = convSel.rows[0]?.id;
    if (!conversationId) {
      const ins = await client.query(
        `INSERT INTO conversations (org_id, channel_id, contact_id, status, last_message_at, unread_count)
           VALUES ($1,$2,$3,'open',NOW(),0)
           RETURNING id`,
        [orgId, channelId, contactId]
      );
      conversationId = ins.rows[0].id;
    }

    await client.query('COMMIT');
    return { orgId, conversationId, contactId };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
}

export async function downloadMediaToAsset({ orgId, url, kind, filename }) {
  // baixar mídia e salvar no storage configurado; registrar em assets e retornar asset_id
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  const id = uuidv4();
  // salvar em disco/S3 conforme sua infra; registre em assets (org_id, kind, path, meta)
  return id; // asset_id
}

export async function persistInboundMessage({ db, orgId, conversationId, provider, providerMessage, mediaDownloader }) {
  // Normalizar texto e anexos (image/file/audio), baixar mídia quando necessário e salvar em message_attachments
  // Inserir em messages (direction='in', status='delivered' por ex.)
  // Se áudio: enfileirar transcrição (content:transcribe)
  return { messageId: 1, textNormalized: '...texto...' };
}
