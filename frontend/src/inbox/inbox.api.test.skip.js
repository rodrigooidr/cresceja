import { rest } from 'msw';
import { setupServer } from 'msw/node';
import inboxApi from '../api/inboxApi';
import normalizeMessage from './normalizeMessage';

const server = setupServer(
  rest.get('/conversations', (req, res, ctx) => {
    if (
      req.url.searchParams.get('search') === 'hello' &&
      req.url.searchParams.get('channels') === 'whatsapp'
    ) {
      return res(ctx.json({ items: [{ id: '1' }] }));
    }
    return res(ctx.json({ items: [] }));
  }),
  rest.post('/conversations/1/messages', async (req, res, ctx) => {
    const body = await req.json();
    if (body.type === 'text') {
      return res(ctx.json({ message: { id: 'm1', type: 'text', text: body.text } }));
    }
    if (body.type === 'file') {
      return res(
        ctx.json({
          message: {
            id: 'm2',
            type: 'file',
            attachments: body.attachments.map((id) => ({ id, url: `/a/${id}` })),
          },
        })
      );
    }
    if (body.type === 'template') {
      return res(ctx.json({ message: { id: 'm3', type: 'template', text: 'tpl' } }));
    }
    return res(ctx.status(400));
  }),
  rest.put('/conversations/1/ai', async (req, res, ctx) => {
    const body = await req.json();
    return res(ctx.json({ conversation: { id: '1', ai_enabled: body.enabled } }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('GET /conversations with filters', async () => {
  const { data } = await inboxApi.get('/conversations', {
    params: { search: 'hello', channels: 'whatsapp' },
  });
  expect(Array.isArray(data.items)).toBe(true);
  expect(data.items[0].id).toBe('1');
});

test('POST /messages variations', async () => {
  const textRes = await inboxApi.post('/conversations/1/messages', {
    type: 'text',
    text: 'hi',
  });
  expect(normalizeMessage(textRes.data.message)).toMatchObject({ type: 'text', text: 'hi' });

  const fileRes = await inboxApi.post('/conversations/1/messages', {
    type: 'file',
    attachments: ['a1'],
  });
  expect(normalizeMessage(fileRes.data.message).attachments[0].id).toBe('a1');

  const tplRes = await inboxApi.post('/conversations/1/messages', {
    type: 'template',
    template_id: 't1',
  });
  expect(normalizeMessage(tplRes.data.message)).toMatchObject({ type: 'template' });
});

test('PUT /conversations/:id/ai', async () => {
  const { data } = await inboxApi.put('/conversations/1/ai', { enabled: true });
  expect(data.conversation.ai_enabled).toBe(true);
});
