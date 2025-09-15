const request = require('supertest');
const express = require('express');
const crypto = require('crypto');
let router;
let setIngest;
let ingestMock;

beforeAll(async () => {
  ({ default: router, _setIngestFn: setIngest } = await import('../routes/webhooks/meta.js'));
});

function app() {
  const app = express();
  app.use('/api/webhooks/meta', express.raw({ type: '*/*' }), router);
  return app;
}

test('messenger webhook triggers ingest', async () => {
  ingestMock = jest.fn().mockResolvedValue();
  setIngest(ingestMock);
  process.env.META_APP_SECRET = 'secret';
  const bodyObj = {
    object: 'page',
    entry: [
      {
        id: 'p1',
        messaging: [
          {
            sender: { id: 'u1' },
            message: { mid: 'm1', text: 'hello' },
            timestamp: 100,
          },
        ],
      },
    ],
  };
  const body = JSON.stringify(bodyObj);
  const sig = 'sha256=' + crypto.createHmac('sha256', 'secret').update(body).digest('hex');
  const res = await request(app())
    .post('/api/webhooks/meta')
    .set('X-Hub-Signature-256', sig)
    .set('Content-Type', 'application/json')
    .send(body);
  expect(res.statusCode).toBe(200);
  expect(ingestMock).toHaveBeenCalledTimes(1);
  expect(ingestMock.mock.calls[0][0]).toMatchObject({ channel: 'facebook' });
});

test('instagram webhook triggers ingest', async () => {
  ingestMock = jest.fn().mockResolvedValue();
  setIngest(ingestMock);
  process.env.META_APP_SECRET = 'secret';
  const bodyObj = {
    object: 'instagram',
    entry: [
      {
        id: 'ig1',
        changes: [
          {
            value: {
              timestamp: '200',
              thread_id: 't1',
              messages: [
                { id: 'm2', from: { id: 'u2' }, text: 'hi', attachments: [] },
              ],
            },
          },
        ],
      },
    ],
  };
  const body = JSON.stringify(bodyObj);
  const sig = 'sha256=' + crypto.createHmac('sha256', 'secret').update(body).digest('hex');
  const res = await request(app())
    .post('/api/webhooks/meta')
    .set('X-Hub-Signature-256', sig)
    .set('Content-Type', 'application/json')
    .send(body);
  expect(res.statusCode).toBe(200);
  expect(ingestMock).toHaveBeenCalledTimes(1);
  expect(ingestMock.mock.calls[0][0]).toMatchObject({ channel: 'instagram' });
});
