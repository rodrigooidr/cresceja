import { http, HttpResponse } from 'msw';

const defaultSummary = {
  whatsapp_official: { max_numbers: 2, items: [] },
  whatsapp_baileys: { enabled: true, items: [] },
  instagram: { connected: false },
  facebook: { connected: false },
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
  // Observação: usar '*/' torna o path robusto a baseURL/proxy
  http.get('*/channels/summary', () => HttpResponse.json(summary)),

  // WhatsApp Official
  http.post('/channels/whatsapp/official/numbers', async ({ request }) => {
    const { label, phone_e164 } = await request.json();
    const id = 'waof_' + (summary.whatsapp_official.items.length + 1);
    const item = { id, label, phone_e164, status: 'verifying' };
    summary.whatsapp_official.items.push(item);
    return HttpResponse.json(item);
  }),
  http.post('/channels/whatsapp/official/numbers/:id/verify', async ({ params }) => {
    const { id } = params;
    const item = summary.whatsapp_official.items.find((i) => i.id === id);
    if (item) item.status = 'connected';
    return HttpResponse.json({});
  }),
  http.delete('/channels/whatsapp/official/numbers/:id', ({ params }) => {
    const { id } = params;
    summary.whatsapp_official.items = summary.whatsapp_official.items.filter((i) => i.id !== id);
    return HttpResponse.json({});
  }),

  // WhatsApp Baileys sessions
  http.post('/channels/whatsapp/baileys/sessions', async ({ request }) => {
    const { label } = await request.json();
    const id = 'sess_' + (summary.whatsapp_baileys.items.length + 1);
    const item = { id, label, status: 'qr' };
    summary.whatsapp_baileys.items.push(item);
    return HttpResponse.json(item);
  }),
  http.get('/channels/whatsapp/baileys/sessions/:id/qr', () =>
    HttpResponse.json({ qr_data_url: 'data:image/png;base64,AAAA' }),
  ),
  http.get('/channels/whatsapp/baileys/sessions/:id', ({ params }) => {
    const { id } = params;
    const sess = summary.whatsapp_baileys.items.find((i) => i.id === id);
    if (sess && sess.status === 'qr') {
      sess.status = 'connected';
      sess.phone_e164 = '+5511999990000';
    }
    return HttpResponse.json(sess || {});
  }),
  http.delete('/channels/whatsapp/baileys/sessions/:id', ({ params }) => {
    const { id } = params;
    summary.whatsapp_baileys.items = summary.whatsapp_baileys.items.filter((i) => i.id !== id);
    return HttpResponse.json({});
  }),

  // Instagram
  http.get('/channels/instagram', () => HttpResponse.json(summary.instagram)),
  http.post('/channels/instagram/connect', () => {
    summary.instagram.connected = true;
    return HttpResponse.json({});
  }),
  http.delete('/channels/instagram/disconnect', () => {
    summary.instagram.connected = false;
    return HttpResponse.json({});
  }),

  // Facebook
  http.get('/channels/facebook', () => HttpResponse.json(summary.facebook)),
  http.post('/channels/facebook/connect', () => {
    summary.facebook.connected = true;
    return HttpResponse.json({});
  }),
  http.delete('/channels/facebook/disconnect', () => {
    summary.facebook.connected = false;
    return HttpResponse.json({});
  }),
];

