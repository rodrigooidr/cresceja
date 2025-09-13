const request = require('supertest');
const express = require('express');

const app = express();
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

describe('health', () => {
  it('GET /api/health returns 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
  });
});
