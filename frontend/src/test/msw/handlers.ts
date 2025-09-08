import { rest } from 'msw';

const API = process.env.REACT_APP_API_BASE_URL || 'http://localhost:4000/api';
const now = '2024-01-01T12:00:00Z';

// helpers
const convos = [
  { id: 'c1', name: 'Alice', contact_name: 'Alice', last_message_at: now, updated_at: now, status: 'open' },
  { id: 'c2', name: 'Bob',   contact_name: 'Bob',   last_message_at: now, updated_at: now, status: 'open' },
];
const msgs = (id: string) => ([
  { id: 'm1', conversation_id: id, text: 'hi',    direction: 'in',  sender: 'contact', created_at: now },
  { id: 'm2', conversation_id: id, text: 'reply', direction: 'out', sender: 'agent',   created_at: now, status: 'sent' },
]);

export const handlers = [
  // Conversas (ambas famílias)
  rest.get(`${API}/inbox/conversations`, (_req, res, ctx) =>
    res(ctx.json({ data: { items: convos, total: 2 } }))
  ),
  rest.get(`${API}/conversations`, (_req, res, ctx) =>
    res(ctx.json({ data: { items: convos, total: 2 } }))
  ),

  // Mensagens por conversa (ASC)
  rest.get(`${API}/inbox/conversations/:id/messages`, (req, res, ctx) => {
    const id = req.params.id as string;
    return res(ctx.json({ data: { items: msgs(id), total: 2 } }));
  }),
  rest.get(`${API}/conversations/:id/messages`, (req, res, ctx) => {
    const id = req.params.id as string;
    return res(ctx.json({ data: { items: msgs(id), total: 2 } }));
  }),

  // Templates / quick replies
  rest.get(`${API}/inbox/templates`, (_req, res, ctx) =>
    res(ctx.json({ data: { items: [{ id: 't1', title: 'Boas-vindas', text: 'Bem-vindo(a)!' }] } }))
  ),
  rest.get(`${API}/inbox/quick-replies`, (_req, res, ctx) =>
    res(ctx.json({ data: { items: [{ id: 'q1', title: 'Olá!', content: 'Olá, como posso ajudar?' }] } }))
  ),

  // Channels summary
  rest.get(`${API}/channels/summary`, (_req, res, ctx) =>
    res(ctx.json({
      data: {
        items: {
          whatsapp_official: { status: 'disconnected' },
          whatsapp_baileys:  { status: 'disconnected' },
          instagram:         { status: 'disconnected' },
          facebook:          { status: 'disconnected' },
          google_calendar:   { status: 'disconnected' },
        }
      }
    }))
  ),

  // Orgs (global)
  rest.get(`${API}/orgs`, (_req, res, ctx) =>
    res(ctx.json({
      data: {
        items: [
          { id: '00000000-0000-0000-0000-000000000001', name: 'Default Org', slug: 'default', status: 'active', created_at: now },
          { id: '00000000-0000-0000-0000-000000000002', name: 'Acme Inc.',   slug: 'acme',    status: 'active', created_at: now },
        ],
        total: 2, page: 1, pageSize: 50,
      }
    }))
  ),
];
