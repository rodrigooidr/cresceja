// v2: use http/HttpResponse
import { http, HttpResponse } from 'msw';

// capture any host
const any = (path) => `*${path}`;

// helpers: parse URL de forma segura
function q(request, key) {
  const url = new URL(request.url);
  return url.searchParams.get(key);
}

export const handlers = [
  http.get(any('/api/inbox/conversations'), async ({ request }) => {
    const tags = q(request, 'tags'); // ok mesmo em Node
    const status = q(request, 'status');
    // ... gere um dataset simples em memória:
    const data = [{
      id: 'conv-1',
      unread_count: 0,
      ai_enabled: false,
      client: { id: 'c-1', name: 'Maria' },
      last_message: { id: 'm-1', text: 'Oi', direction: 'in', authorId: 'c-1' }
    }];
    return HttpResponse.json({ items: data, total: data.length });
  }),

  http.put(any('/api/inbox/conversations/:id/read'), async ({ params }) => {
    // simule sucesso
    return HttpResponse.json({ ok: true, id: params.id });
  }),

  http.put(any('/api/inbox/conversations/:id/client'), async ({ request, params }) => {
    // se for JSON:
    const body = await request.json().catch(() => ({}));
    // valide mínimas chaves esperadas:
    const client = {
      id: body.id ?? 'c-1',
      name: body.name ?? 'Cliente',
      birthdate: body.birthdate ?? null,
      notes: body.notes ?? '',
      tags: Array.isArray(body.tags) ? body.tags : []
    };
    return HttpResponse.json({ id: params.id, client });
  }),

  http.post(any('/api/crm/opportunities'), async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(
      { id: 'opp-1', ...body, created_at: new Date().toISOString() },
      { status: 201 }
    );
  }),

  http.post(any('/api/inbox/messages'), async ({ request }) => {
    // aceite tanto JSON (texto) quanto multipart (anexos)
    let payload = {};
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      payload = await request.json();
    } else if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      payload = {
        conversationId: form.get('conversationId'),
        text: form.get('text'),
        // se houver arquivos:
        hasFile: !!form.get('file')
      };
    }
    const msg = {
      id: 'm-out-1',
      conversationId: payload.conversationId ?? 'conv-1',
      text: payload.text ?? '',
      direction: 'out',
      authorId: 'me',
      created_at: new Date().toISOString()
    };
    return HttpResponse.json(msg, { status: 201 });
  }),
];

