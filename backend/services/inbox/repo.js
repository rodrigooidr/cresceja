import { randomUUID } from 'crypto';
import { makeDbRepo } from './repo.db.js';

export function makeMemoryRepo() {
  const channelAccounts = new Map(); // key: channel|external_account_id -> { id, org_id, ... }
  const channelAccountsById = new Map(); // key: id -> row
  const contacts = new Map();        // key: id -> row
  const identities = new Map();      // key: org|channel|accountId|identity -> contact_id
  const conversations = new Map();   // key: id -> row
  const convIdx = new Map();         // key: org|channel|accountId|externalUserId -> conv_id
  const messages = new Map();        // key: id -> row
  const msgExtIdx = new Map();       // key: org|external_message_id -> msg_id

  function seedChannelAccount(row) {
    const id = row.id || randomUUID();
    const rec = { ...row, id };
    channelAccounts.set(`${row.channel}|${row.external_account_id}`, rec);
    channelAccountsById.set(id, rec);
    return rec;
  }

  return {
    // --- channel_accounts ---
    async findChannelAccountByExternal({ channel, externalAccountId }) {
      return channelAccounts.get(`${channel}|${externalAccountId}`) || null;
    },
    async seedChannelAccount(row) { return seedChannelAccount(row); },
    async listChannelAccounts({ org_id, channel } = {}) {
      let arr = Array.from(channelAccountsById.values());
      if (org_id) arr = arr.filter((rec) => rec.org_id === org_id);
      if (channel) arr = arr.filter((rec) => rec.channel === channel);
      return arr;
    },
    async getChannelAccountById(id) {
      return channelAccountsById.get(id) || null;
    },
    async setChannelAccountSubscribed(id, subscribed = true) {
      const rec = channelAccountsById.get(id);
      if (!rec) return null;
      const next = { ...rec, webhook_subscribed: subscribed };
      channelAccountsById.set(id, next);
      channelAccounts.set(`${next.channel}|${next.external_account_id}`, next);
      return next;
    },
    async markAccountSubscribed(id) {
      return this.setChannelAccountSubscribed(id, true);
    },
    async deleteChannelAccount(id) {
      const rec = channelAccountsById.get(id);
      if (rec) {
        channelAccountsById.delete(id);
        channelAccounts.delete(`${rec.channel}|${rec.external_account_id}`);
      }
    },

    // --- contacts / identities ---
    async findContactIdByIdentity({ org_id, channel, account_id, identity }) {
      return identities.get(`${org_id}|${channel}|${account_id}|${identity}`) || null;
    },
    async createContactWithIdentity({ org_id, name = '—', channel, account_id, identity }) {
      const id = randomUUID();
      contacts.set(id, { id, org_id, name, created_at: new Date() });
      identities.set(`${org_id}|${channel}|${account_id}|${identity}`, id);
      return contacts.get(id);
    },

    // --- conversations ---
    async findConversation({ org_id, channel, account_id, external_user_id }) {
      const key = `${org_id}|${channel}|${account_id}|${external_user_id}`;
      const convId = convIdx.get(key);
      return convId ? conversations.get(convId) : null;
    },
    async getConversationById(id, org_id) {
      const c = conversations.get(id);
      if (!c) return null;
      if (org_id && c.org_id !== org_id) return null;
      return c;
    },
    async createConversation(row) {
      const id = randomUUID();
      const rec = { id, ...row };
      conversations.set(id, rec);
      const idxKey = `${row.org_id}|${row.channel}|${row.account_id}|${row.external_user_id}`;
      convIdx.set(idxKey, id);
      return rec;
    },
    async updateConversation(id, patch) {
      const cur = conversations.get(id);
      if (!cur) return null;
      const next = { ...cur, ...patch };
      conversations.set(id, next);
      return next;
    },

    // --- messages ---
    async findMessageByExternalId({ org_id, external_message_id }) {
      const id = msgExtIdx.get(`${org_id}|${external_message_id}`);
      return id ? messages.get(id) : null;
    },
    async createMessage(row) {
      const id = randomUUID();
      const rec = { id, ...row };
      messages.set(id, rec);
      msgExtIdx.set(`${row.org_id}|${row.external_message_id}`, id);
      return rec;
    },
    async updateMessageAttachments(id, attachments) {
      const rec = messages.get(id);
      if (!rec) return null;
      const next = { ...rec, attachments_json: attachments };
      messages.set(id, next);
      return next;
    },
    async getMessageById(id) {
      return messages.get(id) || null;
    },
    async getLastIncomingAt(conversation_id) {
      const arr = Array.from(messages.values()).filter(
        (m) => m.conversation_id === conversation_id && m.direction === 'in'
      );
      if (!arr.length) return null;
      arr.sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at));
      return arr[0].sent_at;
    },
    async appendOutgoingMessage({ org_id, conversation_id, text, raw_json }) {
      const id = randomUUID();
      const rec = {
        id,
        org_id,
        conversation_id,
        external_message_id: `local_${id}`,
        direction: 'out',
        text,
        attachments_json: [],
        sent_at: new Date(),
        raw_json: raw_json || {},
      };
      messages.set(id, rec);
      msgExtIdx.set(`${org_id}|${rec.external_message_id}`, id);
      const conv = conversations.get(conversation_id);
      if (conv) {
        conversations.set(conversation_id, { ...conv, last_message_at: rec.sent_at });
      }
      return rec;
    },

    // --- queries para endpoints ---
    async listConversations({ org_id, channel, account_id, limit = 50, offset = 0 }) {
      let arr = Array.from(conversations.values()).filter(c => c.org_id === org_id);
      if (channel) arr = arr.filter(c => c.channel === channel);
      if (account_id) arr = arr.filter(c => c.account_id === account_id);
      arr.sort((a,b) => new Date(b.last_message_at) - new Date(a.last_message_at));
      return { items: arr.slice(offset, offset + limit), total: arr.length };
    },
    async listMessages({ conversation_id, limit = 50, offset = 0 }) {
      let arr = Array.from(messages.values()).filter(m => m.conversation_id === conversation_id);
      arr.sort((a,b) => new Date(a.sent_at) - new Date(b.sent_at));
      return { items: arr.slice(offset, offset + limit), total: arr.length };
    },
  };
}

let currentRepo = (process.env.INBOX_REPO === 'db') ? makeDbRepo() : makeMemoryRepo();
export function setInboxRepo(repo) { currentRepo = repo; }
export function getInboxRepo() { return currentRepo; }
