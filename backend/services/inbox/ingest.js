import { getInboxRepo } from './repo.js';

async function resolveOrgIdByAccount(channel, externalAccountId) {
  const repo = getInboxRepo();
  const acc = await repo.findChannelAccountByExternal({ channel, externalAccountId });
  return acc ? acc.org_id : null;
}

export async function ingestIncoming(evt) {
  const repo = getInboxRepo();

  // 1) Descobre org e account
  const org_id = await resolveOrgIdByAccount(evt.channel, evt.externalAccountId);
  if (!org_id) return; // conta não registrada → ignora
  const acc = await repo.findChannelAccountByExternal({ channel: evt.channel, externalAccountId: evt.externalAccountId });
  if (!acc) return;
  const account_id = acc.id;

  // 2) Contato por identidade (org+canal+conta+externo)
  let contact_id = await repo.findContactIdByIdentity({
    org_id, channel: evt.channel, account_id, identity: evt.externalUserId,
  });
  if (!contact_id) {
    const c = await repo.createContactWithIdentity({
      org_id, name: '—', channel: evt.channel, account_id, identity: evt.externalUserId,
    });
    contact_id = c.id;
  }

  // 3) Conversa por (org, canal, conta, external_user_id)
  let conv = await repo.findConversation({
    org_id, channel: evt.channel, account_id, external_user_id: evt.externalUserId,
  });
  if (!conv) {
    conv = await repo.createConversation({
      org_id,
      channel: evt.channel,
      account_id,
      external_user_id: evt.externalUserId,
      external_thread_id: evt.externalThreadId || null,
      contact_id,
      last_message_at: new Date(evt.timestamp),
      unread_count: 0,
      status: 'open',
    });
  }

  // 4) Mensagem idempotente
  const exists = await repo.findMessageByExternalId({ org_id, external_message_id: evt.messageId });
  if (!exists) {
    await repo.createMessage({
      org_id,
      conversation_id: conv.id,
      external_message_id: evt.messageId,
      direction: 'in',
      text: evt.text || null,
      attachments_json: evt.attachments || [],
      sent_at: new Date(evt.timestamp),
      raw_json: evt.raw,
    });
  }

  // 5) Atualiza conversa
  await repo.updateConversation(conv.id, {
    last_message_at: new Date(evt.timestamp),
    unread_count: (conv.unread_count || 0) + 1,
  });
}
