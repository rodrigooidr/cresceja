// frontend/src/test/msw/handlers.js
import { rest } from 'msw';

// Base da API usada no app/testes
const API = process.env.REACT_APP_API_BASE_URL || 'http://localhost:4000/api';

/**
 * Estado inicial do Inbox para testes (pode ser sobrescrito por teste)
 */
export const createInboxState = (overrides = {}) => {
  const now = new Date();
  const iso = (d) => new Date(d).toISOString();

  const state = {
    conversations: [
      {
        id: '1',
        title: 'Cliente Teste',
        last_message_at: iso(now),
        unread_count: 2,
        status: 'open',
        channel: 'whatsapp',
        tags: ['vip', 'retornar'],
        client_id: 'c1',
        ai_enabled: true,
      },
      {
        id: '2',
        title: 'Outro Cliente',
        last_message_at: iso(now.getTime() - 3600_000),
        unread_count: 0,
        status: 'open',
        channel: 'instagram',
        tags: ['urgente'],
        client_id: 'c2',
        ai_enabled: false,
      },
    ],
    messagesByConv: {
      '1': [
        {
          id: 'm1',
          conversation_id: '1',
          text: 'Oi, preciso de ajuda',
          created_at: iso(now.getTime() - 1800_000),
          direction: 'inbound',
          author: 'client',
          attachments: [],
        },
        {
          id: 'm2',
          conversation_id: '1',
          text: 'Oi, tudo bem?',
          created_at: iso(now.getTime() - 1200_000),
          direction: 'outbound',
          author: 'agent',
          attachments: [],
        },
      ],
      '2': [
        {
          id: 'm3',
          conversation_id: '2',
          text: 'Olá!',
          created_at: iso(now.getTime() - 7200_000),
          direction: 'inbound',
          author: 'client',
          attachments: [],
        },
      ],
    },
    clients: {
      c1: { id: 'c1', name: 'Cliente Teste', birthdate: null, extra_info: '', tags: ['vip'] },
      c2: { id: 'c2', name: 'Outro Cliente', birthdate: null, extra_info: '', tags: [] },
    },
    templates: [
      { id: 't1', title: 'Saudação', content: 'Olá! Como posso ajudar?' },
      { id: 't2', title: 'Agradecimento', content: 'Obrigado pelo contato. Já estou verificando.' },
    ],
    assetsCounter: 0,
  };

  return Object.assign(state, overrides);
};

/**
 * Handlers MSW para todos os endpoints do Inbox
 */
export const makeHandlers = (state) => [
  // LISTAR CONVERSAS (com filtros)
  rest.get(`${API}/inbox/conversations`, (req, res, ctx) => {
    const q = (req.url.searchParams.get('q') || '').toLowerCase();
    const status = req.url.searchParams.get('status');
    const channel = req.url.searchParams.get('channel');
    const tags = req.url.searchParams.getAll('tag'); // array

    let items = state.conversations.slice();

    if (q) {
      items = items.filter((c) => {
        const cname = state.clients[c.client_id]?.name?.toLowerCase() || '';
        return c.title?.toLowerCase().includes(q) || cname.includes(q);
      });
    }
    if (status) items = items.filter((c) => c.status === status);
    if (channel && channel !== 'all') items = items.filter((c) => c.channel === channel);
    if (tags.length) items = items.filter((c) => tags.every((t) => c.tags?.includes(t)));

    return res(ctx.delay(30), ctx.json(items));
  }),

  // MENSAGENS DA CONVERSA
  rest.get(`${API}/inbox/conversations/:id/messages`, (req, res, ctx) => {
    const id = String(req.params.id);
    const msgs = state.messagesByConv[id] || [];
    return res(ctx.delay(30), ctx.json(msgs));
  }),

  // ENVIAR MENSAGEM
  rest.post(`${API}/inbox/conversations/:id/messages`, async (req, res, ctx) => {
    const id = String(req.params.id);
    const body = await req.json();
    const newMsg = {
      id: `m_${Date.now()}`,
      conversation_id: id,
      text: body.text || '',
      created_at: new Date().toISOString(),
      direction: 'outbound',
      author: 'agent',
      attachments: (body.attachments || []).map((assetId) => ({
        id: assetId,
        url: `/assets/${assetId}`,
        thumb_url: `/assets/${assetId}.thumb`,
        filename: `file_${assetId}`,
        mime: 'application/octet-stream',
      })),
    };
    state.messagesByConv[id] = [...(state.messagesByConv[id] || []), newMsg];

    const conv = state.conversations.find((c) => c.id === id);
    if (conv) conv.last_message_at = newMsg.created_at;

    return res(ctx.json(newMsg));
  }),

  // MARCAR COMO LIDA
  rest.post(`${API}/inbox/conversations/:id/read`, (req, res, ctx) => {
    const id = String(req.params.id);
    const conv = state.conversations.find((c) => c.id === id);
    if (conv) conv.unread_count = 0;
    return res(ctx.json({ ok: true }));
  }),

  // ATUALIZAR STATUS
  rest.put(`${API}/inbox/conversations/:id/status`, async (req, res, ctx) => {
    const id = String(req.params.id);
    const { status } = await req.json();
    const conv = state.conversations.find((c) => c.id === id);
    if (conv) conv.status = status;
    return res(ctx.json({ ok: true }));
  }),

  // ATUALIZAR TAGS DA CONVERSA
  rest.put(`${API}/inbox/conversations/:id/tags`, async (req, res, ctx) => {
    const id = String(req.params.id);
    const { tags = [] } = await req.json();
    const conv = state.conversations.find((c) => c.id === id);
    if (conv) conv.tags = tags;
    return res(ctx.json({ ok: true }));
  }),

  // UPLOAD DE ANEXOS (simulado)
  rest.post(`${API}/inbox/conversations/:id/attachments`, async (_req, res, ctx) => {
    const assetId = `a_${++state.assetsCounter}`;
    return res(
      ctx.json({
        assets: [
          {
            id: assetId,
            url: `/assets/${assetId}`,
            thumb_url: `/assets/${assetId}.thumb`,
            filename: `upload_${assetId}.png`,
            mime_type: 'image/png',
          },
        ],
      })
    );
  }),

  // TOGGLE IA
  rest.put(`${API}/inbox/conversations/:id/ai`, async (req, res, ctx) => {
    const id = String(req.params.id);
    const { enabled } = await req.json();
    const conv = state.conversations.find((c) => c.id === id);
    if (conv) conv.ai_enabled = !!enabled;
    return res(ctx.json({ ai_enabled: conv?.ai_enabled ?? !!enabled }));
  }),

  // TEMPLATES
  rest.get(`${API}/inbox/templates`, (_req, res, ctx) => res(ctx.json(state.templates))),

  // CLIENTE (GET/PUT)
  rest.get(`${API}/inbox/conversations/:id/client`, (req, res, ctx) => {
    const id = String(req.params.id);
    const conv = state.conversations.find((c) => c.id === id);
    const cli = conv ? state.clients[conv.client_id] : null;
    if (!cli) return res(ctx.status(404), ctx.json({ message: 'not found' }));
    return res(ctx.json(cli));
  }),

  rest.put(`${API}/inbox/conversations/:id/client`, async (req, res, ctx) => {
    const id = String(req.params.id);
    const patch = await req.json();
    const conv = state.conversations.find((c) => c.id === id);
    if (!conv) return res(ctx.status(404), ctx.json({ message: 'conversation not found' }));
    const cid = conv.client_id;
    state.clients[cid] = { ...state.clients[cid], ...patch };
    return res(ctx.json(state.clients[cid]));
  }),

  // ENVIAR PARA O FUNIL
  rest.post(`${API}/crm/funnel/from-conversation`, async (req, res, ctx) => {
    const { conversation_id } = await req.json();
    return res(ctx.json({ opportunity_id: `opp_${conversation_id}` }));
  }),
];

export { rest };
