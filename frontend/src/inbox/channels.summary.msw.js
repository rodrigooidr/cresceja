import { rest } from 'msw';

const defaultSummary = {
  whatsapp_official: { max_numbers: 2, items: [] },
  whatsapp_baileys: { allowed: true, max_slots: 1, items: [] },
  instagram: { enabled: true, connected: false },
  facebook: { enabled: true, connected: false },
};

let summary = JSON.parse(JSON.stringify(defaultSummary));

export function resetSummary() {
  summary = JSON.parse(JSON.stringify(defaultSummary));
}

export function setBaileysAllowed(flag) {
  summary.whatsapp_baileys.allowed = flag;
}

export function addOfficialNumber(item) {
  summary.whatsapp_official.items.push(item);
}

export function addBaileysSession(item) {
  summary.whatsapp_baileys.items.push(item);
}

export const handlers = [
  // Summary dashboard
  rest.get('/channels/summary', (req, res, ctx) => {
    return res(ctx.json(summary));
  }),

  // WhatsApp Official
  rest.post('/channels/whatsapp/official/numbers', async (req, res, ctx) => {
    const { label, phone_e164 } = await req.json();
    const id = 'waof_' + (summary.whatsapp_official.items.length + 1);
    const item = { id, label, phone_e164, status: 'verifying' };
    summary.whatsapp_official.items.push(item);
    return res(ctx.json(item));
  }),
  rest.post('/channels/whatsapp/official/numbers/:id/verify', async (req, res, ctx) => {
    const { id } = req.params;
    const item = summary.whatsapp_official.items.find((i) => i.id === id);
    if (item) item.status = 'connected';
    return res(ctx.json({}));
  }),
  rest.delete('/channels/whatsapp/official/numbers/:id', (req, res, ctx) => {
    const { id } = req.params;
    summary.whatsapp_official.items = summary.whatsapp_official.items.filter((i) => i.id !== id);
    return res(ctx.json({}));
  }),

  // WhatsApp Baileys sessions
  rest.post('/channels/whatsapp/baileys/sessions', async (req, res, ctx) => {
    const { label } = await req.json();
    const id = 'sess_' + (summary.whatsapp_baileys.items.length + 1);
    const item = { id, label, status: 'qr' };
    summary.whatsapp_baileys.items.push(item);
    return res(ctx.json(item));
  }),
  rest.get('/channels/whatsapp/baileys/sessions/:id/qr', (req, res, ctx) => {
    return res(ctx.json({ qr_data_url: 'data:image/png;base64,AAAA' }));
  }),
  rest.get('/channels/whatsapp/baileys/sessions/:id', (req, res, ctx) => {
    const { id } = req.params;
    const sess = summary.whatsapp_baileys.items.find((i) => i.id === id);
    if (sess && sess.status === 'qr') {
      sess.status = 'connected';
      sess.phone_e164 = '+5511999990000';
    }
    return res(ctx.json(sess || {}));
  }),
  rest.delete('/channels/whatsapp/baileys/sessions/:id', (req, res, ctx) => {
    const { id } = req.params;
    summary.whatsapp_baileys.items = summary.whatsapp_baileys.items.filter((i) => i.id !== id);
    return res(ctx.json({}));
  }),

  // Instagram
  rest.get('/channels/instagram', (req, res, ctx) => {
    return res(ctx.json(summary.instagram));
  }),
  rest.post('/channels/instagram/connect', (req, res, ctx) => {
    summary.instagram.connected = true;
    return res(ctx.json({}));
  }),
  rest.delete('/channels/instagram/disconnect', (req, res, ctx) => {
    summary.instagram.connected = false;
    return res(ctx.json({}));
  }),

  // Facebook
  rest.get('/channels/facebook', (req, res, ctx) => {
    return res(ctx.json(summary.facebook));
  }),
  rest.post('/channels/facebook/connect', (req, res, ctx) => {
    summary.facebook.connected = true;
    return res(ctx.json({}));
  }),
  rest.delete('/channels/facebook/disconnect', (req, res, ctx) => {
    summary.facebook.connected = false;
    return res(ctx.json({}));
  }),
];
