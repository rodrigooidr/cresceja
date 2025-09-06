const express = require('express');

const app = express();
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

test('GET /api/health returns ok', async () => {
  const server = app.listen(0);
  const { port } = server.address();
  const res = await fetch(`http://127.0.0.1:${port}/api/health`);
  const json = await res.json();
  server.close();
  expect(res.status).toBe(200);
  expect(json.status).toBe('ok');
});
