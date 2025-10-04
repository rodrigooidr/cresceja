const { rest } = require('msw');

// use wildcard "*/api/..." para casar qualquer origem (3000, 4000, relativo)
const api = (path) => `*/api${path.startsWith('/') ? '' : '/'}${path}`;

// ====== Fixtures mínimas ======
const now = Date.now();
const fixtures = {
  org: { id: '11111111-1111-1111-1111-111111111111', name: 'Org Demo', plan: 'pro' },
  user: { id: '22222222-2222-2222-2222-222222222222', email: 'test@demo.com', name: 'Tester' },
  conversations: [
    { id: 'c1', channel: 'WhatsApp', title: 'Cliente 1', unread: 1, status: 'open', assignee: null, lastMessageAt: now - 10_000 },
    { id: 'c2', channel: 'Instagram', title: 'Cliente 2', unread: 0, status: 'open', assignee: 'agent:2222', lastMessageAt: now - 20_000 },
  ],
  messages: [
    { id: 'm1', convId: 'c1', from: 'cliente', text: 'Olá!', at: now - 9_000 },
    { id: 'm2', convId: 'c1', from: 'agent', text: 'Oi! Como posso ajudar?', at: now - 8_000 },
  ],
  assets: { page: 1, limit: 20, total: 1, items: [{ id: 'a1', url: '/uploads/fake.png', mime: 'image/png', created_at: new Date().toISOString() }] },
  posts: { items: [{ id: 'p1', title: 'Post demo', body: 'conteúdo', status: 'draft', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }] },
  plans: { items: [{ id: 'free', price_cents: 0 }, { id: 'pro', price_cents: 9900 }] },
  quickActions: [
    { key: 'mark_read', label: 'Marcar como lida', bulk: true },
    { key: 'mark_unread', label: 'Marcar como não lida', bulk: true },
    { key: 'assign_me', label: 'Assumir', bulk: true },
    { key: 'close', label: 'Fechar', bulk: true },
    { key: 'archive', label: 'Arquivar', bulk: true },
  ],
  inboxSettings: { triage: true, sse: true, shortcuts: true },
};

function rid(prefix = 'id') { return `${prefix}_${Math.random().toString(36).slice(2, 9)}`; }

function applyActionToConversation(conv, action, userId) {
  switch (action) {
    case 'mark_read': conv.unread = 0; break;
    case 'mark_unread': conv.unread = (conv.unread || 0) + 1; break;
    case 'assign_me': conv.assignee = `agent:${userId}`; break;
    case 'close': conv.status = 'closed'; break;
    case 'archive': conv.status = 'archived'; break;
    default: break;
  }
}

// ====== Handlers ======
const handlers = [
  // Auth
  rest.post(api('/auth/login'), (_req, res, ctx) => res(ctx.status(200), ctx.json({ token: 'jwt.mock', user: fixtures.user }))),
  rest.post(api('/auth/register'), (_req, res, ctx) => res(ctx.status(201), ctx.json({ token: 'jwt.mock', user: fixtures.user }))),

  // Orgs
  rest.get(api('/orgs/me'), (_req, res, ctx) => res(ctx.status(200), ctx.json(fixtures.org))),

  // Inbox: settings (muitos testes esperam isso)
  rest.get(api('/inbox/settings'), (_req, res, ctx) => res(ctx.status(200), ctx.json(fixtures.inboxSettings))),

  // Inbox: templates / quick-replies
  rest.get(api('/inbox/templates'), (_req, res, ctx) => res(ctx.status(200), ctx.json({ items: [] }))),
  rest.get(api('/inbox/quick-replies'), (_req, res, ctx) => res(ctx.status(200), ctx.json({ items: [] }))),

  // Inbox: quick-actions
  rest.get(api('/inbox/quick-actions'), (_req, res, ctx) => res(ctx.status(200), ctx.json({ items: fixtures.quickActions }))),

  // Execução quick-action (single)
  rest.post(api('/inbox/quick-actions/:action'), async (req, res, ctx) => {
    const { action } = req.params;
    const body = await req.json().catch(() => ({}));
    const { convId } = body || {};
    const conv = fixtures.conversations.find(c => c.id === convId);
    if (!conv) return res(ctx.status(404), ctx.json({ ok: false, error: 'conversation_not_found' }));
    applyActionToConversation(conv, action, fixtures.user.id);
    return res(ctx.status(200), ctx.json({ ok: true, conversation: conv }));
  }),

  // Execução quick-action (bulk)
  rest.post(api('/inbox/quick-actions/bulk'), async (req, res, ctx) => {
    const body = await req.json().catch(() => ({}));
    const { action, ids } = body || {};
    if (!action || !Array.isArray(ids)) return res(ctx.status(400), ctx.json({ ok: false, error: 'invalid_bulk_request' }));
    const updated = [];
    ids.forEach((convId) => {
      const conv = fixtures.conversations.find(c => c.id === convId);
      if (conv) { applyActionToConversation(conv, action, fixtures.user.id); updated.push(conv); }
    });
    return res(ctx.status(200), ctx.json({ ok: true, updated }));
  }),

  // Inbox: lista conversas
  rest.get(api('/inbox/conversations'), (req, res, ctx) => {
    const status = req.url.searchParams.get('status');
    const assigned = req.url.searchParams.get('assigned');
    let items = fixtures.conversations.slice();
    if (status) items = items.filter(c => c.status === status);
    if (assigned === 'me') items = items.filter(c => c.assignee === `agent:${fixtures.user.id}`);
    return res(ctx.status(200), ctx.json({ items }));
  }),

  // Inbox: mensagens da conversa
  rest.get(api('/inbox/conversations/:id/messages'), (req, res, ctx) => {
    const convId = req.params.id;
    return res(ctx.status(200), ctx.json({ items: fixtures.messages.filter(m => m.convId === convId) }));
  }),

  // Inbox: envio otimista (single)
  rest.post(api('/inbox/messages/send'), async (req, res, ctx) => {
    const body = await req.json().catch(() => ({}));
    const { convId, text } = body || {};
    const id = rid('msg');
    const msg = { id, convId, from: 'agent', text: String(text || ''), at: Date.now() };
    fixtures.messages.push(msg);
    const conv = fixtures.conversations.find(c => c.id === convId);
    if (conv) { conv.lastMessageAt = msg.at; conv.unread = 0; conv.status = 'open'; conv.assignee = conv.assignee || `agent:${fixtures.user.id}`; }
    return res(ctx.status(200), ctx.json({ ok: true, id, message: msg, conversation: conv }));
  }),

  // Inbox: envio otimista (bulk)
  rest.post(api('/inbox/messages/bulk'), async (req, res, ctx) => {
    const body = await req.json().catch(() => ({}));
    const { action, ids, text } = body || {};
    if (action !== 'send' || !Array.isArray(ids)) return res(ctx.status(400), ctx.json({ ok: false, error: 'invalid_bulk_request' }));
    const results = ids.map((convId) => {
      const id = rid('msg');
      const msg = { id, convId, from: 'agent', text: String(text || ''), at: Date.now() };
      fixtures.messages.push(msg);
      const conv = fixtures.conversations.find(c => c.id === convId);
      if (conv) { conv.lastMessageAt = msg.at; conv.unread = 0; conv.status = 'open'; conv.assignee = conv.assignee || `agent:${fixtures.user.id}`; }
      return { convId, messageId: id };
    });
    return res(ctx.status(200), ctx.json({ ok: true, results }));
  }),

  // Inbox: atualização parcial da conversa
  rest.patch(api('/inbox/conversations/:id'), async (req, res, ctx) => {
    const id = req.params.id;
    const body = await req.json().catch(() => ({}));
    const conv = fixtures.conversations.find(c => c.id === id);
    if (!conv) return res(ctx.status(404), ctx.json({ ok: false, error: 'conversation_not_found' }));
    if (typeof body.status === 'string') conv.status = body.status;
    if (typeof body.assignee === 'string' || body.assignee === null) conv.assignee = body.assignee;
    if (typeof body.unread === 'number') conv.unread = body.unread;
    return res(ctx.status(200), ctx.json({ ok: true, conversation: conv }));
  }),

  // Conteúdo / Públicos
  rest.get(api('/content/assets'), (_req, res, ctx) => res(ctx.status(200), ctx.json(fixtures.assets))),
  rest.get(api('/content/posts'), (_req, res, ctx) => res(ctx.status(200), ctx.json(fixtures.posts))),
  rest.post(api('/content/posts'), (_req, res, ctx) => res(ctx.status(201), ctx.json(fixtures.posts.items[0]))),
  rest.post(api('/uploads'), (_req, res, ctx) => res(ctx.status(201), ctx.json({ url: '/uploads/fake.png', mime: 'image/png', name: 'fake.png', size: 1234 }))),

  rest.get(api('/public/plans'), (_req, res, ctx) => res(ctx.status(200), ctx.json(fixtures.plans))),

  // Health (algumas suites chamam)
  rest.get('*/health', (_req, res, ctx) => res(ctx.status(200), ctx.json({ ok: true }))),
];

module.exports = { handlers, fixtures };
