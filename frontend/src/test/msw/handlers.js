import { http, HttpResponse } from 'msw';
const any = (path) => `*${path}`;

export const handlers = [
  http.get(any('/api/inbox/conversations'), ({ request }) => {
    const url = new URL(request.url);
    return HttpResponse.json({ items: [{ id: 'conv-1', unread_count: 0 }], total: 1 });
  }),

  http.put(any('/api/inbox/conversations/:id/read'), ({ params }) =>
    HttpResponse.json({ ok: true, id: params.id })
  ),

  http.put(any('/api/inbox/conversations/:id/client'), async ({ request, params }) => {
    const body = await request.json().catch(() => ({}));
    return HttpResponse.json({ id: params.id, client: body });
  }),

  http.post(any('/api/crm/opportunities'), async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: 'opp-1', ...body }, { status: 201 });
  }),

  http.post(any('/api/inbox/messages'), async ({ request }) => {
    const ct = request.headers.get('content-type') || '';
    let payload = {};
    if (ct.includes('application/json')) payload = await request.json();
    else if (ct.includes('multipart/form-data')) {
      const fd = await request.formData();
      payload = { conversationId: fd.get('conversationId'), text: fd.get('text') };
    }
    return HttpResponse.json(
      {
        id: 'm-out-1',
        conversationId: payload.conversationId ?? 'conv-1',
        text: payload.text ?? '',
        direction: 'out',
        authorId: 'me',
      },
      { status: 201 }
    );
  }),
];
