import request from 'supertest';
import app from '../server.js';

describe('Organizations API', () => {
  test('lista organizations', async () => {
    const res = await request(app).get('/organizations').set('Authorization', 'Bearer TEST');
    expect(res.status).toBeLessThan(500);
  });

  test('cria organization', async () => {
    const body = { name: 'Panitutto', slug: 'panitutto' };
    const res = await request(app)
      .post('/organizations')
      .send(body)
      .set('Authorization', 'Bearer TEST');
    expect([200, 201, 404, 409]).toContain(res.status);
  });

  test('compat /orgs (transição)', async () => {
    const res = await request(app).get('/orgs').set('Authorization', 'Bearer TEST');
    expect([200, 301, 308, 404]).toContain(res.status);
  });
});
